package com.nexus.notification.service;

import com.nexus.notification.integration.SendGridIntegration;
import com.nexus.notification.integration.SendGridIntegration.EmailRequest;
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import io.github.resilience4j.ratelimiter.annotation.RateLimiter;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.retry.annotation.Retryable;
import org.springframework.stereotype.Service;
import org.springframework.scheduling.annotation.Async;
import org.springframework.validation.annotation.Validated;
import lombok.extern.slf4j.Slf4j;
import lombok.RequiredArgsConstructor;
import lombok.Getter;
import lombok.Setter;
import lombok.Builder;

import java.util.Map;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.time.Instant;
import java.util.stream.Collectors;

/**
 * Enterprise-grade notification service handling multi-channel notifications
 * with enhanced reliability, monitoring, and security features.
 * 
 * @version 1.0
 * @since 2023-09-01
 */
@Slf4j
@Service
@RequiredArgsConstructor
@Validated
public class NotificationService {

    private static final String NOTIFICATION_TOPIC = "nexus.notifications";
    private static final String DEAD_LETTER_TOPIC = "nexus.notifications.dlq";
    private static final int MAX_RETRY_ATTEMPTS = 3;
    private static final int BATCH_SIZE = 100;

    private final SendGridIntegration sendGridIntegration;
    private final KafkaTemplate<String, NotificationEvent> kafkaTemplate;

    @Getter
    @Setter
    @Builder
    public static class NotificationRequest {
        private String type;
        private String recipient;
        private String subject;
        private Map<String, Object> content;
        private String templateId;
        private NotificationPriority priority;
        private DeliveryPreferences deliveryPreferences;
        private String idempotencyKey;

        @Builder.Default
        private Instant timestamp = Instant.now();

        public boolean validate() {
            if (recipient == null || type == null) {
                return false;
            }
            if (content == null && templateId == null) {
                return false;
            }
            if (idempotencyKey == null) {
                idempotencyKey = UUID.randomUUID().toString();
            }
            return true;
        }
    }

    @Getter
    public enum NotificationPriority {
        HIGH(0), MEDIUM(1), LOW(2);
        private final int value;
        NotificationPriority(int value) {
            this.value = value;
        }
    }

    @Getter
    @Setter
    @Builder
    public static class DeliveryPreferences {
        private boolean trackDelivery;
        private boolean requireConfirmation;
        private Map<String, String> channelSpecificSettings;
    }

    @Getter
    @Setter
    @Builder
    public static class NotificationResult {
        private String notificationId;
        private String status;
        private String channel;
        private Instant deliveryTimestamp;
        private Map<String, Object> metadata;
    }

    @Getter
    @Setter
    @Builder
    public static class BulkNotificationResult {
        private int totalCount;
        private int successCount;
        private int failureCount;
        private List<NotificationResult> results;
        private Map<String, Object> metadata;
    }

    /**
     * Sends a notification through appropriate channel with enhanced reliability
     * and monitoring capabilities.
     *
     * @param request The notification request
     * @return CompletableFuture<NotificationResult> with delivery status
     */
    @Async
    @CircuitBreaker(name = "notification")
    @RateLimiter(name = "notification")
    @Retryable(maxAttempts = MAX_RETRY_ATTEMPTS)
    public CompletableFuture<NotificationResult> sendNotification(NotificationRequest request) {
        log.debug("Processing notification request: {}", request.getIdempotencyKey());
        
        try {
            if (!request.validate()) {
                log.error("Invalid notification request: {}", request.getIdempotencyKey());
                return CompletableFuture.completedFuture(buildFailureResult(request));
            }

            NotificationResult result;
            switch (request.getType().toLowerCase()) {
                case "email":
                    result = sendEmailNotification(request);
                    break;
                case "event":
                    result = sendEventNotification(request);
                    break;
                default:
                    log.error("Unsupported notification type: {}", request.getType());
                    return CompletableFuture.completedFuture(buildFailureResult(request));
            }

            log.info("Notification sent successfully: {}", request.getIdempotencyKey());
            return CompletableFuture.completedFuture(result);

        } catch (Exception e) {
            log.error("Failed to send notification: {}", e.getMessage(), e);
            return CompletableFuture.completedFuture(buildFailureResult(request));
        }
    }

    /**
     * Sends multiple notifications in bulk with batching and rate limiting.
     *
     * @param requests List of notification requests
     * @return CompletableFuture<BulkNotificationResult> with consolidated results
     */
    @Async
    @CircuitBreaker(name = "bulk-notification")
    @RateLimiter(name = "bulk-notification")
    public CompletableFuture<BulkNotificationResult> sendBulkNotifications(List<NotificationRequest> requests) {
        log.debug("Processing bulk notification request with {} items", requests.size());

        List<List<NotificationRequest>> batches = splitIntoBatches(requests);
        List<NotificationResult> results = new ArrayList<>();
        int successCount = 0;
        int failureCount = 0;

        for (List<NotificationRequest> batch : batches) {
            List<CompletableFuture<NotificationResult>> batchFutures = batch.stream()
                .map(this::sendNotification)
                .collect(Collectors.toList());

            CompletableFuture.allOf(batchFutures.toArray(new CompletableFuture[0]))
                .thenAccept(v -> {
                    for (CompletableFuture<NotificationResult> future : batchFutures) {
                        NotificationResult result = future.join();
                        results.add(result);
                        if ("SUCCESS".equals(result.getStatus())) {
                            successCount++;
                        } else {
                            failureCount++;
                        }
                    }
                })
                .join();
        }

        return CompletableFuture.completedFuture(BulkNotificationResult.builder()
            .totalCount(requests.size())
            .successCount(successCount)
            .failureCount(failureCount)
            .results(results)
            .metadata(Map.of("completedAt", Instant.now()))
            .build());
    }

    private NotificationResult sendEmailNotification(NotificationRequest request) {
        EmailRequest emailRequest = EmailRequest.builder()
            .to(request.getRecipient())
            .subject(request.getSubject())
            .templateId(request.getTemplateId())
            .templateData(request.getContent())
            .trackOpens(request.getDeliveryPreferences().isTrackDelivery())
            .trackClicks(request.getDeliveryPreferences().isTrackDelivery())
            .build();

        boolean success = sendGridIntegration.sendEmail(emailRequest).join();
        
        return NotificationResult.builder()
            .notificationId(request.getIdempotencyKey())
            .status(success ? "SUCCESS" : "FAILURE")
            .channel("EMAIL")
            .deliveryTimestamp(Instant.now())
            .metadata(Map.of("emailId", emailRequest.getTo()))
            .build();
    }

    private NotificationResult sendEventNotification(NotificationRequest request) {
        NotificationEvent event = NotificationEvent.builder()
            .id(request.getIdempotencyKey())
            .type(request.getType())
            .recipient(request.getRecipient())
            .content(request.getContent())
            .timestamp(request.getTimestamp())
            .build();

        try {
            kafkaTemplate.send(NOTIFICATION_TOPIC, request.getRecipient(), event);
            
            return NotificationResult.builder()
                .notificationId(request.getIdempotencyKey())
                .status("SUCCESS")
                .channel("EVENT")
                .deliveryTimestamp(Instant.now())
                .metadata(Map.of("topic", NOTIFICATION_TOPIC))
                .build();
        } catch (Exception e) {
            log.error("Failed to send event notification: {}", e.getMessage(), e);
            kafkaTemplate.send(DEAD_LETTER_TOPIC, request.getRecipient(), event);
            return buildFailureResult(request);
        }
    }

    private NotificationResult buildFailureResult(NotificationRequest request) {
        return NotificationResult.builder()
            .notificationId(request.getIdempotencyKey())
            .status("FAILURE")
            .channel(request.getType().toUpperCase())
            .deliveryTimestamp(Instant.now())
            .build();
    }

    private List<List<NotificationRequest>> splitIntoBatches(List<NotificationRequest> requests) {
        List<List<NotificationRequest>> batches = new ArrayList<>();
        for (int i = 0; i < requests.size(); i += BATCH_SIZE) {
            batches.add(requests.subList(i, Math.min(i + BATCH_SIZE, requests.size())));
        }
        return batches;
    }

    @Getter
    @Setter
    @Builder
    private static class NotificationEvent {
        private String id;
        private String type;
        private String recipient;
        private Map<String, Object> content;
        private Instant timestamp;
    }
}