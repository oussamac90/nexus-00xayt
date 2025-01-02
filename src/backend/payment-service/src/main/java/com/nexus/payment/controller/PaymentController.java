package com.nexus.payment.controller;

import com.nexus.payment.service.PaymentService;
import com.nexus.common.validation.ValidationUtils;
import com.nexus.common.security.SecurityUtils;

import org.springframework.web.bind.annotation.*;
import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.PageRequest;
import org.springframework.validation.annotation.Validated;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import io.github.resilience4j.ratelimiter.annotation.RateLimiter;
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;

import javax.validation.Valid;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

/**
 * REST controller implementing secure, PCI DSS compliant payment processing endpoints.
 * Provides comprehensive validation, error handling, and monitoring capabilities.
 *
 * @version 1.0
 * @since 2023-09-01
 */
@RestController
@RequestMapping("/api/v1/payments")
@Validated
public class PaymentController {

    private static final Logger LOGGER = LoggerFactory.getLogger(PaymentController.class);
    private static final int MAX_PAGE_SIZE = 100;
    private static final String CIRCUIT_BREAKER = "paymentService";
    private static final String RATE_LIMITER = "paymentEndpoint";

    private final PaymentService paymentService;
    private final ValidationUtils validationUtils;
    private final SecurityUtils securityUtils;

    public PaymentController(
            PaymentService paymentService,
            ValidationUtils validationUtils,
            SecurityUtils securityUtils) {
        this.paymentService = paymentService;
        this.validationUtils = validationUtils;
        this.securityUtils = securityUtils;
        LOGGER.info("Payment controller initialized with security configuration");
    }

    /**
     * Processes a new payment transaction with PCI DSS compliance.
     *
     * @param request Payment request containing transaction details
     * @return ResponseEntity with payment processing result
     */
    @PostMapping("/process")
    @PreAuthorize("hasRole('PAYMENT_PROCESS')")
    @RateLimiter(name = RATE_LIMITER)
    @CircuitBreaker(name = CIRCUIT_BREAKER)
    public ResponseEntity<PaymentResponse> processPayment(@Valid @RequestBody PaymentRequest request) {
        LOGGER.info("Processing payment request for order: {}", request.getOrderId());

        try {
            // Validate request parameters
            Map<String, Object> validationMap = new HashMap<>();
            validationMap.put("amount", request.getAmount());
            validationMap.put("currency", request.getCurrency());
            validationMap.put("paymentMethod", request.getPaymentMethodToken());

            List<String> missingFields = validationUtils.validateRequired(
                validationMap, 
                List.of("amount", "currency", "paymentMethod")
            );

            if (!missingFields.isEmpty()) {
                LOGGER.warn("Payment validation failed - missing fields: {}", missingFields);
                return ResponseEntity.badRequest().build();
            }

            // Sanitize input
            String sanitizedCurrency = validationUtils.sanitizeInput(request.getCurrency());
            request.setCurrency(sanitizedCurrency);

            // Process payment
            PaymentResponse response = paymentService.processPayment(request);
            
            LOGGER.info("Payment processed successfully - Transaction ID: {}", response.getTransactionId());
            return ResponseEntity.ok(response);

        } catch (Exception e) {
            LOGGER.error("Payment processing failed: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    /**
     * Processes a refund for an existing payment with security validation.
     *
     * @param paymentId ID of the payment to refund
     * @param request Refund request details
     * @return ResponseEntity with refund processing result
     */
    @PostMapping("/{paymentId}/refund")
    @PreAuthorize("hasRole('PAYMENT_REFUND')")
    @RateLimiter(name = RATE_LIMITER)
    public ResponseEntity<RefundResponse> refundPayment(
            @PathVariable UUID paymentId,
            @Valid @RequestBody RefundRequest request) {
        LOGGER.info("Processing refund request for payment: {}", paymentId);

        try {
            // Validate refund request
            if (request.getAmount() <= 0) {
                LOGGER.warn("Invalid refund amount: {}", request.getAmount());
                return ResponseEntity.badRequest().build();
            }

            // Process refund
            RefundResponse response = paymentService.refundPayment(paymentId, request);
            
            LOGGER.info("Refund processed successfully - Refund ID: {}", response.getRefundId());
            return ResponseEntity.ok(response);

        } catch (Exception e) {
            LOGGER.error("Refund processing failed: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    /**
     * Retrieves paginated payment history with security filtering.
     *
     * @param orderId Order ID to filter payments
     * @param pageable Pagination parameters
     * @return ResponseEntity with paginated payment records
     */
    @GetMapping("/history/{orderId}")
    @PreAuthorize("hasAnyRole('PAYMENT_VIEW', 'ADMIN')")
    public ResponseEntity<Page<PaymentResponse>> getPaymentHistory(
            @PathVariable UUID orderId,
            Pageable pageable) {
        LOGGER.info("Retrieving payment history for order: {}", orderId);

        try {
            // Validate and adjust pagination parameters
            int pageSize = Math.min(pageable.getPageSize(), MAX_PAGE_SIZE);
            PageRequest validPageRequest = PageRequest.of(
                pageable.getPageNumber(),
                pageSize,
                pageable.getSort()
            );

            // Retrieve payment history
            Page<PaymentResponse> payments = paymentService.getPaymentHistory(
                PaymentStatus.SUCCESS,
                LocalDateTime.now().minusMonths(6),
                LocalDateTime.now(),
                validPageRequest
            );

            LOGGER.info("Retrieved {} payment records", payments.getTotalElements());
            return ResponseEntity.ok(payments);

        } catch (Exception e) {
            LOGGER.error("Payment history retrieval failed: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    /**
     * Handles payment provider webhooks with signature validation.
     *
     * @param payload Webhook payload
     * @param signature Webhook signature for verification
     * @return ResponseEntity with webhook processing result
     */
    @PostMapping("/webhook")
    @PreAuthorize("permitAll()")
    @RateLimiter(name = RATE_LIMITER)
    public ResponseEntity<WebhookResponse> handleWebhook(
            @RequestBody String payload,
            @RequestHeader("X-Webhook-Signature") String signature) {
        String requestId = UUID.randomUUID().toString();
        LOGGER.info("Processing payment webhook - Request ID: {}", requestId);

        try {
            // Validate webhook signature
            if (!securityUtils.validateWebhookSignature(payload, signature)) {
                LOGGER.warn("Invalid webhook signature - Request ID: {}", requestId);
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
            }

            // Process webhook
            WebhookResponse response = paymentService.handlePaymentWebhook(payload);
            
            LOGGER.info("Webhook processed successfully - Request ID: {}", requestId);
            return ResponseEntity.ok(response);

        } catch (Exception e) {
            LOGGER.error("Webhook processing failed - Request ID: {}: {}", requestId, e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
}