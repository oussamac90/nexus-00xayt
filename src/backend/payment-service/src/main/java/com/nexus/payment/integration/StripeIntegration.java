package com.nexus.payment.integration;

import com.nexus.common.security.SecurityUtils;
import com.stripe.Stripe;
import com.stripe.model.PaymentIntent;
import com.stripe.model.Refund;
import com.stripe.model.Subscription;
import com.stripe.exception.StripeException;
import com.stripe.net.RequestOptions;
import com.stripe.param.PaymentIntentCreateParams;
import com.stripe.param.RefundCreateParams;
import org.springframework.stereotype.Service;
import org.springframework.beans.factory.annotation.Value;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.retry.support.RetryTemplate;
import org.springframework.retry.policy.SimpleRetryPolicy;
import org.springframework.retry.backoff.ExponentialBackOffPolicy;
import io.github.resilience4j.circuitbreaker.CircuitBreaker;
import io.github.resilience4j.circuitbreaker.CircuitBreakerConfig;

import java.util.HashMap;
import java.util.Map;
import javax.annotation.PostConstruct;
import java.security.GeneralSecurityException;

/**
 * Enterprise-grade Stripe payment gateway integration service implementing PCI DSS compliant
 * payment processing with comprehensive security measures and monitoring.
 *
 * @version 1.0
 * @since 2023-07-01
 */
@Service
public class StripeIntegration {

    private static final Logger LOGGER = LoggerFactory.getLogger(StripeIntegration.class);
    
    @Value("${stripe.api.key}")
    private String stripeApiKey;
    
    @Value("${stripe.webhook.secret}")
    private String stripeWebhookSecret;
    
    private static final int MAX_RETRY_ATTEMPTS = 3;
    private static final long RETRY_DELAY_MS = 1000;
    
    private final RetryTemplate retryTemplate;
    private final CircuitBreaker circuitBreaker;

    public StripeIntegration() {
        // Configure retry template with exponential backoff
        this.retryTemplate = RetryTemplate.builder()
            .retryOn(StripeException.class)
            .maxAttempts(MAX_RETRY_ATTEMPTS)
            .exponentialBackoff(RETRY_DELAY_MS, 2, 10000)
            .build();

        // Configure circuit breaker
        CircuitBreakerConfig config = CircuitBreakerConfig.custom()
            .failureRateThreshold(50)
            .waitDurationInOpenState(java.time.Duration.ofSeconds(30))
            .permittedNumberOfCallsInHalfOpenState(5)
            .slidingWindowSize(10)
            .build();
        
        this.circuitBreaker = CircuitBreaker.of("stripeIntegration", config);
    }

    @PostConstruct
    private void init() {
        Stripe.apiKey = this.stripeApiKey;
    }

    /**
     * Processes a payment through Stripe with secure tokenization and comprehensive error handling.
     *
     * @param request The payment request containing amount, currency and payment method details
     * @return PaymentResponse containing transaction details and status
     * @throws PaymentProcessingException if payment processing fails
     */
    public PaymentResponse processPayment(PaymentRequest request) {
        LOGGER.info("Processing payment request for amount: {} {}", request.getAmount(), request.getCurrency());
        
        try {
            // Validate request parameters
            validateRequest(request);

            // Encrypt sensitive payment data
            String encryptedPaymentMethod = SecurityUtils.encrypt(
                request.getPaymentMethodToken(),
                stripeApiKey
            );

            // Create payment intent with retry mechanism
            PaymentIntent paymentIntent = retryTemplate.execute(context -> {
                PaymentIntentCreateParams params = PaymentIntentCreateParams.builder()
                    .setAmount(request.getAmount())
                    .setCurrency(request.getCurrency().toLowerCase())
                    .setPaymentMethod(encryptedPaymentMethod)
                    .setConfirm(true)
                    .setSetupFutureUsage(request.isRecurring() ? 
                        PaymentIntentCreateParams.SetupFutureUsage.OFF_SESSION : null)
                    .build();

                return circuitBreaker.executeSupplier(() -> 
                    PaymentIntent.create(params)
                );
            });

            // Handle 3D Secure authentication if required
            if ("requires_action".equals(paymentIntent.getStatus())) {
                return PaymentResponse.builder()
                    .status(PaymentStatus.REQUIRES_AUTHENTICATION)
                    .clientSecret(paymentIntent.getClientSecret())
                    .transactionId(paymentIntent.getId())
                    .build();
            }

            // Log successful transaction
            logTransaction(paymentIntent, request);

            return PaymentResponse.builder()
                .status(PaymentStatus.SUCCESS)
                .transactionId(paymentIntent.getId())
                .amount(paymentIntent.getAmount())
                .currency(paymentIntent.getCurrency())
                .build();

        } catch (StripeException e) {
            LOGGER.error("Stripe payment processing failed: {}", e.getMessage(), e);
            throw new PaymentProcessingException("Payment processing failed", e);
        } catch (GeneralSecurityException e) {
            LOGGER.error("Payment data encryption failed: {}", e.getMessage(), e);
            throw new PaymentProcessingException("Payment security error", e);
        }
    }

    /**
     * Processes a refund with enhanced validation and comprehensive audit logging.
     *
     * @param paymentIntentId The ID of the payment to refund
     * @param request The refund request details
     * @return RefundResponse containing refund details and status
     * @throws RefundProcessingException if refund processing fails
     */
    public RefundResponse refundPayment(String paymentIntentId, RefundRequest request) {
        LOGGER.info("Processing refund for payment: {}", paymentIntentId);

        try {
            // Validate refund request
            validateRefundRequest(paymentIntentId, request);

            // Process refund with retry mechanism
            Refund refund = retryTemplate.execute(context -> {
                RefundCreateParams params = RefundCreateParams.builder()
                    .setPaymentIntent(paymentIntentId)
                    .setAmount(request.getAmount())
                    .setReason(mapRefundReason(request.getReason()))
                    .build();

                return circuitBreaker.executeSupplier(() ->
                    Refund.create(params)
                );
            });

            // Log refund transaction
            logRefundTransaction(refund, request);

            return RefundResponse.builder()
                .status(RefundStatus.SUCCESS)
                .refundId(refund.getId())
                .amount(refund.getAmount())
                .currency(refund.getCurrency())
                .build();

        } catch (StripeException e) {
            LOGGER.error("Stripe refund processing failed: {}", e.getMessage(), e);
            throw new RefundProcessingException("Refund processing failed", e);
        }
    }

    /**
     * Validates payment request parameters.
     *
     * @param request The payment request to validate
     * @throws IllegalArgumentException if validation fails
     */
    private void validateRequest(PaymentRequest request) {
        if (request == null) {
            throw new IllegalArgumentException("Payment request cannot be null");
        }
        if (request.getAmount() <= 0) {
            throw new IllegalArgumentException("Payment amount must be greater than zero");
        }
        if (request.getCurrency() == null || request.getCurrency().trim().isEmpty()) {
            throw new IllegalArgumentException("Currency is required");
        }
        if (request.getPaymentMethodToken() == null || request.getPaymentMethodToken().trim().isEmpty()) {
            throw new IllegalArgumentException("Payment method token is required");
        }
    }

    /**
     * Validates refund request parameters.
     *
     * @param paymentIntentId The payment intent ID
     * @param request The refund request to validate
     * @throws IllegalArgumentException if validation fails
     */
    private void validateRefundRequest(String paymentIntentId, RefundRequest request) {
        if (paymentIntentId == null || paymentIntentId.trim().isEmpty()) {
            throw new IllegalArgumentException("Payment intent ID is required");
        }
        if (request == null) {
            throw new IllegalArgumentException("Refund request cannot be null");
        }
        if (request.getAmount() <= 0) {
            throw new IllegalArgumentException("Refund amount must be greater than zero");
        }
    }

    /**
     * Logs payment transaction details securely.
     *
     * @param paymentIntent The processed payment intent
     * @param request The original payment request
     */
    private void logTransaction(PaymentIntent paymentIntent, PaymentRequest request) {
        Map<String, Object> auditData = new HashMap<>();
        auditData.put("transactionId", paymentIntent.getId());
        auditData.put("amount", paymentIntent.getAmount());
        auditData.put("currency", paymentIntent.getCurrency());
        auditData.put("status", paymentIntent.getStatus());
        auditData.put("timestamp", System.currentTimeMillis());
        
        LOGGER.info("Payment transaction completed: {}", auditData);
    }

    /**
     * Logs refund transaction details securely.
     *
     * @param refund The processed refund
     * @param request The original refund request
     */
    private void logRefundTransaction(Refund refund, RefundRequest request) {
        Map<String, Object> auditData = new HashMap<>();
        auditData.put("refundId", refund.getId());
        auditData.put("paymentIntent", refund.getPaymentIntent());
        auditData.put("amount", refund.getAmount());
        auditData.put("currency", refund.getCurrency());
        auditData.put("status", refund.getStatus());
        auditData.put("timestamp", System.currentTimeMillis());
        
        LOGGER.info("Refund transaction completed: {}", auditData);
    }

    /**
     * Maps internal refund reason to Stripe refund reason.
     *
     * @param reason The internal refund reason
     * @return Stripe refund reason
     */
    private RefundCreateParams.Reason mapRefundReason(RefundReason reason) {
        switch (reason) {
            case DUPLICATE:
                return RefundCreateParams.Reason.DUPLICATE;
            case FRAUDULENT:
                return RefundCreateParams.Reason.FRAUDULENT;
            case REQUESTED_BY_CUSTOMER:
                return RefundCreateParams.Reason.REQUESTED_BY_CUSTOMER;
            default:
                return null;
        }
    }
}