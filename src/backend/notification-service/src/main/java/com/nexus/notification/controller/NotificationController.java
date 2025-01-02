package com.nexus.notification.controller;

import com.nexus.notification.service.NotificationService;
import com.nexus.notification.service.NotificationService.NotificationRequest;
import com.nexus.notification.service.NotificationService.NotificationResult;
import com.nexus.notification.service.NotificationService.BulkNotificationResult;
import io.github.resilience4j.ratelimiter.annotation.RateLimiter;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import javax.validation.constraints.NotEmpty;
import javax.validation.constraints.Size;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import org.slf4j.MDC;
import java.util.UUID;

/**
 * REST controller for managing notifications across the Nexus platform.
 * Provides endpoints for sending notifications, managing preferences, and tracking status.
 *
 * @version 1.0
 * @since 2023-09-01
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/notifications")
@RequiredArgsConstructor
@Validated
@Tag(name = "Notification API", description = "Endpoints for notification management")
public class NotificationController {

    private static final String RATE_LIMIT_KEY = "notification-api";
    private static final int BULK_BATCH_SIZE = 100;
    private static final String X_CORRELATION_ID = "X-Correlation-ID";

    private final NotificationService notificationService;

    /**
     * Sends a single notification with enhanced error handling and tracking.
     *
     * @param request The notification request
     * @return ResponseEntity containing the async notification result
     */
    @PostMapping("/send")
    @Operation(summary = "Send a notification", 
              description = "Sends a single notification through the specified channel")
    @ApiResponse(responseCode = "202", description = "Notification accepted for processing")
    @RateLimiter(name = RATE_LIMIT_KEY)
    public ResponseEntity<CompletableFuture<NotificationResult>> sendNotification(
            @Valid @RequestBody NotificationRequest request,
            @RequestHeader(value = X_CORRELATION_ID, required = false) String correlationId) {
        
        String trackingId = correlationId != null ? correlationId : UUID.randomUUID().toString();
        MDC.put("correlationId", trackingId);
        
        try {
            log.info("Processing notification request: {}", trackingId);
            
            CompletableFuture<NotificationResult> future = notificationService.sendNotification(request)
                .thenApply(result -> {
                    log.info("Notification processed: {}, status: {}", trackingId, result.getStatus());
                    return result;
                })
                .exceptionally(ex -> {
                    log.error("Notification processing failed: {}", ex.getMessage(), ex);
                    throw new RuntimeException("Notification processing failed", ex);
                });

            return ResponseEntity.accepted().body(future);
        } finally {
            MDC.remove("correlationId");
        }
    }

    /**
     * Sends multiple notifications in bulk with batching and parallel processing.
     *
     * @param requests List of notification requests
     * @return ResponseEntity containing the async bulk notification result
     */
    @PostMapping("/send/bulk")
    @Operation(summary = "Send bulk notifications", 
              description = "Sends multiple notifications in bulk with batching")
    @ApiResponse(responseCode = "202", description = "Bulk notifications accepted for processing")
    @RateLimiter(name = RATE_LIMIT_KEY)
    public ResponseEntity<CompletableFuture<BulkNotificationResult>> sendBulkNotifications(
            @Valid @RequestBody @NotEmpty @Size(max = BULK_BATCH_SIZE) List<NotificationRequest> requests,
            @RequestHeader(value = X_CORRELATION_ID, required = false) String correlationId) {
        
        String trackingId = correlationId != null ? correlationId : UUID.randomUUID().toString();
        MDC.put("correlationId", trackingId);
        
        try {
            log.info("Processing bulk notification request: {}, size: {}", trackingId, requests.size());
            
            CompletableFuture<BulkNotificationResult> future = notificationService.sendBulkNotifications(requests)
                .thenApply(result -> {
                    log.info("Bulk notifications processed: {}, success: {}, failure: {}", 
                        trackingId, result.getSuccessCount(), result.getFailureCount());
                    return result;
                })
                .exceptionally(ex -> {
                    log.error("Bulk notification processing failed: {}", ex.getMessage(), ex);
                    throw new RuntimeException("Bulk notification processing failed", ex);
                });

            return ResponseEntity.accepted().body(future);
        } finally {
            MDC.remove("correlationId");
        }
    }

    /**
     * Retrieves the status of a notification with detailed tracking information.
     *
     * @param notificationId The unique identifier of the notification
     * @return ResponseEntity containing the notification status
     */
    @GetMapping("/status/{notificationId}")
    @Operation(summary = "Get notification status", 
              description = "Retrieves the detailed delivery status of a notification")
    @ApiResponse(responseCode = "200", description = "Notification status retrieved successfully")
    @RateLimiter(name = RATE_LIMIT_KEY)
    public ResponseEntity<NotificationResult> getNotificationStatus(
            @PathVariable String notificationId,
            @RequestHeader(value = X_CORRELATION_ID, required = false) String correlationId) {
        
        String trackingId = correlationId != null ? correlationId : UUID.randomUUID().toString();
        MDC.put("correlationId", trackingId);
        
        try {
            log.info("Retrieving notification status: {}", notificationId);
            
            NotificationResult result = notificationService.sendNotification(
                NotificationRequest.builder()
                    .idempotencyKey(notificationId)
                    .build()
            ).join();

            log.info("Retrieved notification status: {}, status: {}", notificationId, result.getStatus());
            
            return ResponseEntity.ok(result);
        } finally {
            MDC.remove("correlationId");
        }
    }
}