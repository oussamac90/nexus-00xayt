package com.nexus.notification.integration;

import com.nexus.common.exception.GlobalExceptionHandler;
import com.sendgrid.SendGrid;
import com.sendgrid.helpers.mail.Mail;
import com.sendgrid.helpers.mail.objects.Content;
import com.sendgrid.helpers.mail.objects.Email;
import com.sendgrid.helpers.mail.objects.Personalization;
import com.sendgrid.Method;
import com.sendgrid.Request;
import com.sendgrid.Response;
import org.springframework.stereotype.Service;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.retry.annotation.Retry;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.scheduling.annotation.Async;
import lombok.extern.slf4j.Slf4j;
import lombok.Getter;
import lombok.Setter;
import lombok.Builder;
import lombok.ToString;

import java.util.Map;
import java.util.List;
import java.util.ArrayList;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.Semaphore;
import java.util.regex.Pattern;
import java.io.IOException;
import java.time.Duration;

/**
 * Enterprise-grade SendGrid integration service for handling email communications
 * with support for templating, tracking, and bulk processing capabilities.
 * 
 * @version 1.0
 * @since 2023-09-01
 */
@Slf4j
@Service
public class SendGridIntegration {

    private static final Pattern EMAIL_PATTERN = Pattern.compile("^[A-Za-z0-9+_.-]+@(.+)$");
    private static final int MAX_CONTENT_LENGTH = 1000000; // 1MB
    private static final Duration TEMPLATE_CACHE_DURATION = Duration.ofHours(1);

    @Value("${sendgrid.api-key}")
    private String sendGridApiKey;

    @Value("${sendgrid.from-email}")
    private String defaultFromEmail;

    @Value("${sendgrid.batch-size:100}")
    private int batchSize;

    @Value("${sendgrid.rate-limit:100}")
    private int rateLimitPerSecond;

    private final SendGrid sendGrid;
    private final Semaphore rateLimiter;

    public SendGridIntegration() {
        this.sendGrid = new SendGrid(sendGridApiKey);
        this.rateLimiter = new Semaphore(rateLimitPerSecond);
    }

    @Getter
    @Setter
    @Builder
    @ToString(exclude = {"content", "templateData"})
    public static class EmailRequest {
        private String to;
        private String from;
        private String subject;
        private String templateId;
        private Map<String, Object> templateData;
        private String content;
        private boolean trackOpens;
        private boolean trackClicks;
        private Map<String, String> customHeaders;
        private List<String> categories;

        public boolean validate() {
            if (to == null || subject == null || (content == null && templateId == null)) {
                return false;
            }
            if (!EMAIL_PATTERN.matcher(to).matches()) {
                return false;
            }
            if (content != null && content.length() > MAX_CONTENT_LENGTH) {
                return false;
            }
            return true;
        }
    }

    /**
     * Sends a single email asynchronously with retry capability and monitoring
     *
     * @param request The email request containing recipient and content details
     * @return CompletableFuture<Boolean> indicating the delivery status
     */
    @Async
    @Retry(maxAttempts = 3)
    public CompletableFuture<Boolean> sendEmail(EmailRequest request) {
        try {
            if (!request.validate()) {
                log.error("Invalid email request: {}", request);
                return CompletableFuture.completedFuture(false);
            }

            rateLimiter.acquire();
            try {
                Mail mail = buildMailObject(request);
                Request sendGridRequest = buildSendGridRequest(mail);
                Response response = sendGrid.api(sendGridRequest);

                boolean success = response.getStatusCode() >= 200 && response.getStatusCode() < 300;
                logEmailMetrics(request, response, success);
                return CompletableFuture.completedFuture(success);
            } finally {
                rateLimiter.release();
            }
        } catch (Exception e) {
            log.error("Failed to send email: {}", e.getMessage(), e);
            return CompletableFuture.completedFuture(false);
        }
    }

    /**
     * Sends multiple emails in bulk with optimized batch processing
     *
     * @param requests List of email requests to process
     * @return CompletableFuture<List<Boolean>> containing delivery status for each email
     */
    @Async
    @Retry(maxAttempts = 3)
    public CompletableFuture<List<Boolean>> sendBulkEmails(List<EmailRequest> requests) {
        List<Boolean> results = new ArrayList<>();
        List<List<EmailRequest>> batches = splitIntoBatches(requests);

        for (List<EmailRequest> batch : batches) {
            List<CompletableFuture<Boolean>> batchFutures = batch.stream()
                .map(this::sendEmail)
                .collect(java.util.stream.Collectors.toList());

            CompletableFuture.allOf(batchFutures.toArray(new CompletableFuture[0]))
                .thenAccept(v -> batchFutures.forEach(f -> results.add(f.join())))
                .join();

            logBatchMetrics(batch, results);
        }

        return CompletableFuture.completedFuture(results);
    }

    /**
     * Validates template existence and status with caching
     *
     * @param templateId The SendGrid template ID to validate
     * @return boolean indicating template validity
     */
    @Cacheable(value = "templates", key = "#templateId")
    public boolean validateTemplate(String templateId) {
        try {
            Request request = new Request();
            request.setMethod(Method.GET);
            request.setEndpoint("templates/" + templateId);
            
            Response response = sendGrid.api(request);
            return response.getStatusCode() == 200;
        } catch (IOException e) {
            log.error("Template validation failed: {}", e.getMessage(), e);
            return false;
        }
    }

    private Mail buildMailObject(EmailRequest request) {
        Email from = new Email(request.getFrom() != null ? request.getFrom() : defaultFromEmail);
        Email to = new Email(request.getTo());
        Content content = new Content("text/html", request.getContent());
        Mail mail = new Mail(from, request.getSubject(), to, content);

        if (request.getTemplateId() != null) {
            mail.setTemplateId(request.getTemplateId());
            if (request.getTemplateData() != null) {
                Personalization personalization = new Personalization();
                request.getTemplateData().forEach(personalization::addDynamicTemplateData);
                mail.addPersonalization(personalization);
            }
        }

        mail.setTrackingSettings(buildTrackingSettings(request));
        
        if (request.getCustomHeaders() != null) {
            request.getCustomHeaders().forEach(mail::addHeader);
        }
        
        if (request.getCategories() != null) {
            request.getCategories().forEach(mail::addCategory);
        }

        return mail;
    }

    private Request buildSendGridRequest(Mail mail) throws IOException {
        Request request = new Request();
        request.setMethod(Method.POST);
        request.setEndpoint("mail/send");
        request.setBody(mail.build());
        return request;
    }

    private List<List<EmailRequest>> splitIntoBatches(List<EmailRequest> requests) {
        List<List<EmailRequest>> batches = new ArrayList<>();
        for (int i = 0; i < requests.size(); i += batchSize) {
            batches.add(requests.subList(i, Math.min(i + batchSize, requests.size())));
        }
        return batches;
    }

    private void logEmailMetrics(EmailRequest request, Response response, boolean success) {
        log.info("Email sent - To: {}, Template: {}, Status: {}, Response Code: {}",
            request.getTo(),
            request.getTemplateId(),
            success ? "SUCCESS" : "FAILURE",
            response.getStatusCode());
    }

    private void logBatchMetrics(List<EmailRequest> batch, List<Boolean> results) {
        long successCount = results.stream().filter(Boolean::booleanValue).count();
        log.info("Batch processed - Size: {}, Success: {}, Failure: {}",
            batch.size(),
            successCount,
            batch.size() - successCount);
    }

    private com.sendgrid.helpers.mail.objects.TrackingSettings buildTrackingSettings(EmailRequest request) {
        com.sendgrid.helpers.mail.objects.TrackingSettings trackingSettings = 
            new com.sendgrid.helpers.mail.objects.TrackingSettings();
        
        if (request.isTrackOpens()) {
            trackingSettings.setOpenTracking(new com.sendgrid.helpers.mail.objects.OpenTracking(true));
        }
        
        if (request.isTrackClicks()) {
            trackingSettings.setClickTracking(new com.sendgrid.helpers.mail.objects.ClickTracking(true, true));
        }
        
        return trackingSettings;
    }
}