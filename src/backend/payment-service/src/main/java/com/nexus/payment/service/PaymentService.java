package com.nexus.payment.service;

import com.nexus.payment.repository.PaymentRepository;
import com.nexus.payment.integration.StripeIntegration;
import com.nexus.common.security.SecurityUtils;
import com.nexus.payment.model.*;
import com.nexus.payment.exception.*;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.retry.annotation.Retry;
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.time.LocalDateTime;
import java.util.UUID;
import java.util.Map;
import java.util.HashMap;
import java.security.GeneralSecurityException;

/**
 * Enterprise-grade payment processing service implementing PCI DSS compliant
 * payment operations with comprehensive security and monitoring.
 *
 * @version 1.0
 * @since 2023-09-01
 */
@Service
@Transactional
public class PaymentService {

    private static final Logger LOGGER = LoggerFactory.getLogger(PaymentService.class);
    private static final int MAX_RETRY_ATTEMPTS = 3;
    private static final String CIRCUIT_BREAKER_NAME = "stripePayment";

    private final PaymentRepository paymentRepository;
    private final StripeIntegration stripeIntegration;

    /**
     * Initializes payment service with required dependencies and security configurations.
     */
    public PaymentService(PaymentRepository paymentRepository, StripeIntegration stripeIntegration) {
        this.paymentRepository = paymentRepository;
        this.stripeIntegration = stripeIntegration;
        LOGGER.info("Payment service initialized with enhanced security configuration");
    }

    /**
     * Processes a payment request with comprehensive validation and security measures.
     *
     * @param request Payment request containing transaction details
     * @return PaymentResponse with transaction result
     * @throws PaymentProcessingException if payment processing fails
     */
    @Transactional
    @CircuitBreaker(name = CIRCUIT_BREAKER_NAME)
    @Retry(maxAttempts = MAX_RETRY_ATTEMPTS)
    public PaymentResponse processPayment(PaymentRequest request) {
        LOGGER.info("Processing payment request for order: {}", request.getOrderId());
        
        try {
            // Validate request and user authorization
            validatePaymentRequest(request);
            validateUserAuthorization(request.getOrderId());

            // Create payment record
            Payment payment = createPaymentRecord(request);
            
            // Process payment through Stripe
            PaymentResponse stripeResponse = stripeIntegration.processPayment(request);
            
            // Update payment record with transaction details
            updatePaymentRecord(payment, stripeResponse);
            
            // Log transaction for audit
            logPaymentTransaction(payment, stripeResponse);
            
            return stripeResponse;

        } catch (Exception e) {
            LOGGER.error("Payment processing failed: {}", e.getMessage(), e);
            throw new PaymentProcessingException("Payment processing failed", e);
        }
    }

    /**
     * Processes a refund request with validation and security checks.
     *
     * @param paymentId Payment ID to refund
     * @param request Refund request details
     * @return RefundResponse with refund result
     * @throws RefundProcessingException if refund processing fails
     */
    @Transactional
    @CircuitBreaker(name = CIRCUIT_BREAKER_NAME)
    @Retry(maxAttempts = MAX_RETRY_ATTEMPTS)
    public RefundResponse refundPayment(UUID paymentId, RefundRequest request) {
        LOGGER.info("Processing refund request for payment: {}", paymentId);
        
        try {
            // Retrieve and validate payment
            Payment payment = paymentRepository.findById(paymentId)
                .orElseThrow(() -> new PaymentNotFoundException("Payment not found: " + paymentId));
            
            validateRefundRequest(payment, request);
            
            // Process refund through Stripe
            RefundResponse refundResponse = stripeIntegration.refundPayment(
                payment.getTransactionId(), 
                request
            );
            
            // Update payment status
            payment.setStatus(PaymentStatus.REFUNDED);
            payment.setRefundedAmount(request.getAmount());
            payment.setRefundedAt(LocalDateTime.now());
            paymentRepository.save(payment);
            
            // Log refund transaction
            logRefundTransaction(payment, refundResponse);
            
            return refundResponse;

        } catch (Exception e) {
            LOGGER.error("Refund processing failed: {}", e.getMessage(), e);
            throw new RefundProcessingException("Refund processing failed", e);
        }
    }

    /**
     * Retrieves payment history with filtering and pagination.
     *
     * @param status Payment status filter
     * @param startDate Start date range
     * @param endDate End date range
     * @param pageable Pagination parameters
     * @return Page of Payment records
     */
    @Transactional(readOnly = true)
    public Page<Payment> getPaymentHistory(
            PaymentStatus status,
            LocalDateTime startDate,
            LocalDateTime endDate,
            Pageable pageable) {
        LOGGER.debug("Retrieving payment history with status: {}", status);
        return paymentRepository.findByStatusAndDateRange(status, startDate, endDate, pageable);
    }

    private void validatePaymentRequest(PaymentRequest request) {
        if (request == null) {
            throw new IllegalArgumentException("Payment request cannot be null");
        }
        if (request.getAmount() <= 0) {
            throw new IllegalArgumentException("Payment amount must be greater than zero");
        }
        if (request.getCurrency() == null || request.getCurrency().trim().isEmpty()) {
            throw new IllegalArgumentException("Currency is required");
        }
    }

    private void validateUserAuthorization(UUID orderId) {
        SecurityUtils.getCurrentUser()
            .orElseThrow(() -> new UnauthorizedAccessException("User not authenticated"));
        
        if (!SecurityUtils.hasRole("PAYMENT_PROCESS")) {
            throw new UnauthorizedAccessException("User not authorized to process payments");
        }
    }

    private Payment createPaymentRecord(PaymentRequest request) {
        Payment payment = new Payment();
        payment.setOrderId(request.getOrderId());
        payment.setAmount(request.getAmount());
        payment.setCurrency(request.getCurrency());
        payment.setStatus(PaymentStatus.PENDING);
        payment.setCreatedBy(SecurityUtils.getCurrentUser().orElse("SYSTEM"));
        return paymentRepository.save(payment);
    }

    private void updatePaymentRecord(Payment payment, PaymentResponse response) {
        payment.setTransactionId(response.getTransactionId());
        payment.setStatus(response.getStatus());
        payment.setProcessedAt(LocalDateTime.now());
        paymentRepository.save(payment);
    }

    private void validateRefundRequest(Payment payment, RefundRequest request) {
        if (payment.getStatus() != PaymentStatus.SUCCESS) {
            throw new IllegalStateException("Payment must be successful to process refund");
        }
        if (request.getAmount() > payment.getAmount()) {
            throw new IllegalArgumentException("Refund amount cannot exceed payment amount");
        }
    }

    private void logPaymentTransaction(Payment payment, PaymentResponse response) {
        Map<String, Object> auditData = new HashMap<>();
        auditData.put("paymentId", payment.getId());
        auditData.put("orderId", payment.getOrderId());
        auditData.put("amount", payment.getAmount());
        auditData.put("currency", payment.getCurrency());
        auditData.put("status", response.getStatus());
        auditData.put("transactionId", response.getTransactionId());
        auditData.put("timestamp", LocalDateTime.now());
        
        LOGGER.info("Payment transaction completed: {}", auditData);
    }

    private void logRefundTransaction(Payment payment, RefundResponse response) {
        Map<String, Object> auditData = new HashMap<>();
        auditData.put("paymentId", payment.getId());
        auditData.put("refundId", response.getRefundId());
        auditData.put("amount", response.getAmount());
        auditData.put("status", response.getStatus());
        auditData.put("timestamp", LocalDateTime.now());
        
        LOGGER.info("Refund transaction completed: {}", auditData);
    }
}