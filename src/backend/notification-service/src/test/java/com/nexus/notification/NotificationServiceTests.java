package com.nexus.notification;

import com.nexus.notification.service.NotificationService;
import com.nexus.notification.service.NotificationService.NotificationRequest;
import com.nexus.notification.service.NotificationService.NotificationResult;
import com.nexus.notification.service.NotificationService.BulkNotificationResult;
import com.nexus.notification.service.NotificationService.NotificationPriority;
import com.nexus.notification.service.NotificationService.DeliveryPreferences;
import com.nexus.notification.integration.SendGridIntegration;
import com.nexus.notification.integration.SendGridIntegration.EmailRequest;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeEach;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.test.context.EmbeddedKafka;
import org.springframework.test.context.ActiveProfiles;

import java.util.Map;
import java.util.List;
import java.util.ArrayList;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.time.Instant;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@SpringBootTest
@EmbeddedKafka(partitions = 1, topics = {"nexus.notifications", "nexus.notifications.retry"})
@ActiveProfiles("test")
public class NotificationServiceTests {

    private static final String NOTIFICATION_TOPIC = "nexus.notifications";
    private static final String RETRY_TOPIC = "nexus.notifications.retry";

    @Autowired
    private NotificationService notificationService;

    @MockBean
    private SendGridIntegration sendGridIntegration;

    @MockBean
    private KafkaTemplate<String, Object> kafkaTemplate;

    private NotificationRequest validEmailRequest;
    private NotificationRequest validEventRequest;

    @BeforeEach
    void setUp() {
        // Setup valid email notification request
        validEmailRequest = NotificationRequest.builder()
            .type("email")
            .recipient("test@example.com")
            .subject("Test Subject")
            .content(Map.of("body", "Test content"))
            .priority(NotificationPriority.HIGH)
            .deliveryPreferences(DeliveryPreferences.builder()
                .trackDelivery(true)
                .requireConfirmation(true)
                .build())
            .idempotencyKey(UUID.randomUUID().toString())
            .build();

        // Setup valid event notification request
        validEventRequest = NotificationRequest.builder()
            .type("event")
            .recipient("user123")
            .content(Map.of("eventType", "ORDER_CREATED", "orderId", "12345"))
            .priority(NotificationPriority.MEDIUM)
            .deliveryPreferences(DeliveryPreferences.builder()
                .trackDelivery(true)
                .build())
            .idempotencyKey(UUID.randomUUID().toString())
            .build();

        // Configure default mock behaviors
        when(sendGridIntegration.sendEmail(any(EmailRequest.class)))
            .thenReturn(CompletableFuture.completedFuture(true));
        when(kafkaTemplate.send(anyString(), anyString(), any()))
            .thenReturn(CompletableFuture.completedFuture(null));
    }

    @Test
    void testSendEmailNotification_Success() throws Exception {
        // Arrange
        ArgumentCaptor<EmailRequest> emailCaptor = ArgumentCaptor.forClass(EmailRequest.class);

        // Act
        NotificationResult result = notificationService.sendNotification(validEmailRequest).get();

        // Assert
        verify(sendGridIntegration).sendEmail(emailCaptor.capture());
        EmailRequest capturedRequest = emailCaptor.getValue();
        
        assertNotNull(result);
        assertEquals("SUCCESS", result.getStatus());
        assertEquals("EMAIL", result.getChannel());
        assertEquals(validEmailRequest.getIdempotencyKey(), result.getNotificationId());
        assertEquals(validEmailRequest.getRecipient(), capturedRequest.getTo());
        assertEquals(validEmailRequest.getSubject(), capturedRequest.getSubject());
    }

    @Test
    void testSendEmailNotification_Failure() throws Exception {
        // Arrange
        when(sendGridIntegration.sendEmail(any(EmailRequest.class)))
            .thenReturn(CompletableFuture.completedFuture(false));

        // Act
        NotificationResult result = notificationService.sendNotification(validEmailRequest).get();

        // Assert
        assertNotNull(result);
        assertEquals("FAILURE", result.getStatus());
        assertEquals("EMAIL", result.getChannel());
    }

    @Test
    void testSendEventNotification_Success() throws Exception {
        // Arrange
        ArgumentCaptor<String> topicCaptor = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<Object> eventCaptor = ArgumentCaptor.forClass(Object.class);

        // Act
        NotificationResult result = notificationService.sendNotification(validEventRequest).get();

        // Assert
        verify(kafkaTemplate).send(topicCaptor.capture(), anyString(), eventCaptor.capture());
        
        assertEquals(NOTIFICATION_TOPIC, topicCaptor.getValue());
        assertNotNull(result);
        assertEquals("SUCCESS", result.getStatus());
        assertEquals("EVENT", result.getChannel());
    }

    @Test
    void testSendBulkNotifications() throws Exception {
        // Arrange
        List<NotificationRequest> requests = new ArrayList<>();
        for (int i = 0; i < 5; i++) {
            requests.add(NotificationRequest.builder()
                .type("email")
                .recipient("test" + i + "@example.com")
                .subject("Bulk Test " + i)
                .content(Map.of("body", "Test content " + i))
                .priority(NotificationPriority.LOW)
                .deliveryPreferences(DeliveryPreferences.builder()
                    .trackDelivery(true)
                    .build())
                .idempotencyKey(UUID.randomUUID().toString())
                .build());
        }

        // Act
        BulkNotificationResult result = notificationService.sendBulkNotifications(requests).get();

        // Assert
        assertNotNull(result);
        assertEquals(5, result.getTotalCount());
        assertEquals(5, result.getSuccessCount());
        assertEquals(0, result.getFailureCount());
        assertEquals(5, result.getResults().size());
        verify(sendGridIntegration, times(5)).sendEmail(any(EmailRequest.class));
    }

    @Test
    void testInvalidNotificationRequest() throws Exception {
        // Arrange
        NotificationRequest invalidRequest = NotificationRequest.builder()
            .type("email")
            .recipient(null) // Invalid: missing recipient
            .subject("Test")
            .content(Map.of("body", "Test"))
            .build();

        // Act
        NotificationResult result = notificationService.sendNotification(invalidRequest).get();

        // Assert
        assertNotNull(result);
        assertEquals("FAILURE", result.getStatus());
        verifyNoInteractions(sendGridIntegration);
    }

    @Test
    void testNotificationRetryMechanism() throws Exception {
        // Arrange
        when(sendGridIntegration.sendEmail(any(EmailRequest.class)))
            .thenReturn(CompletableFuture.completedFuture(false))
            .thenReturn(CompletableFuture.completedFuture(false))
            .thenReturn(CompletableFuture.completedFuture(true));

        // Act
        NotificationResult result = notificationService.sendNotification(validEmailRequest).get();

        // Assert
        verify(sendGridIntegration, times(3)).sendEmail(any(EmailRequest.class));
        assertEquals("SUCCESS", result.getStatus());
    }

    @Test
    void testConcurrentNotificationProcessing() throws Exception {
        // Arrange
        int concurrentRequests = 10;
        List<CompletableFuture<NotificationResult>> futures = new ArrayList<>();

        // Act
        for (int i = 0; i < concurrentRequests; i++) {
            NotificationRequest request = NotificationRequest.builder()
                .type("email")
                .recipient("concurrent" + i + "@example.com")
                .subject("Concurrent Test " + i)
                .content(Map.of("body", "Test content"))
                .priority(NotificationPriority.MEDIUM)
                .deliveryPreferences(DeliveryPreferences.builder().trackDelivery(true).build())
                .idempotencyKey(UUID.randomUUID().toString())
                .build();
            
            futures.add(notificationService.sendNotification(request));
        }

        List<NotificationResult> results = futures.stream()
            .map(CompletableFuture::join)
            .toList();

        // Assert
        assertEquals(concurrentRequests, results.size());
        assertTrue(results.stream().allMatch(r -> "SUCCESS".equals(r.getStatus())));
        verify(sendGridIntegration, times(concurrentRequests)).sendEmail(any(EmailRequest.class));
    }
}