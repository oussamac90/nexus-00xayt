package com.nexus.payment;

import com.nexus.payment.service.PaymentService;
import com.nexus.payment.repository.PaymentRepository;
import com.nexus.payment.integration.StripeIntegration;
import com.nexus.payment.model.*;
import com.nexus.payment.exception.*;
import com.nexus.common.security.SecurityUtils;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.mockito.Mock;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

import javax.money.MonetaryAmount;
import javax.money.Monetary;
import java.time.LocalDateTime;
import java.util.UUID;
import java.util.Optional;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.stream.IntStream;

import static org.mockito.Mockito.*;
import static org.junit.jupiter.api.Assertions.*;

/**
 * Comprehensive test suite for PaymentService validating payment processing,
 * security compliance, transaction reliability, and payment history management.
 *
 * @version 1.0
 * @since 2023-09-01
 */
@SpringBootTest
@ActiveProfiles("test")
@DisplayName("Payment Service Tests")
public class PaymentServiceTests {

    @Autowired
    private PaymentService paymentService;

    @MockBean
    private PaymentRepository paymentRepository;

    @MockBean
    private StripeIntegration stripeIntegration;

    @Mock
    private Authentication authentication;

    @Mock
    private SecurityContext securityContext;

    private static final String TEST_USER = "test-user";
    private static final String TEST_CURRENCY = "USD";
    private static final UUID TEST_ORDER_ID = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        // Configure security context
        when(authentication.getName()).thenReturn(TEST_USER);
        when(authentication.isAuthenticated()).thenReturn(true);
        when(securityContext.getAuthentication()).thenReturn(authentication);
        SecurityContextHolder.setContext(securityContext);

        // Configure repository mocks
        when(paymentRepository.save(any(Payment.class))).thenAnswer(i -> i.getArguments()[0]);
    }

    @Nested
    @DisplayName("Payment Processing Tests")
    class PaymentProcessingTests {

        @Test
        @DisplayName("Should successfully process valid payment")
        void testSuccessfulPaymentProcessing() {
            // Arrange
            PaymentRequest request = createTestPaymentRequest();
            PaymentResponse expectedResponse = createSuccessfulPaymentResponse();
            when(stripeIntegration.processPayment(any())).thenReturn(expectedResponse);

            // Act
            PaymentResponse response = paymentService.processPayment(request);

            // Assert
            assertNotNull(response);
            assertEquals(PaymentStatus.SUCCESS, response.getStatus());
            verify(paymentRepository).save(any(Payment.class));
        }

        @Test
        @DisplayName("Should handle 3D Secure authentication requirement")
        void testPaymentRequiring3DSecure() {
            // Arrange
            PaymentRequest request = createTestPaymentRequest();
            PaymentResponse authResponse = PaymentResponse.builder()
                .status(PaymentStatus.REQUIRES_AUTHENTICATION)
                .clientSecret("test_client_secret")
                .build();
            when(stripeIntegration.processPayment(any())).thenReturn(authResponse);

            // Act
            PaymentResponse response = paymentService.processPayment(request);

            // Assert
            assertEquals(PaymentStatus.REQUIRES_AUTHENTICATION, response.getStatus());
            assertNotNull(response.getClientSecret());
        }
    }

    @Nested
    @DisplayName("Security Compliance Tests")
    class SecurityComplianceTests {

        @Test
        @DisplayName("Should enforce PCI DSS compliance for payment data")
        void testPCICompliance() {
            // Arrange
            PaymentRequest request = createTestPaymentRequest();
            request.setPaymentMethodToken("test_token");

            // Act & Assert
            assertDoesNotThrow(() -> {
                paymentService.processPayment(request);
                verify(stripeIntegration).processPayment(argThat(req -> 
                    !req.getPaymentMethodToken().equals("test_token")
                ));
            });
        }

        @Test
        @DisplayName("Should validate user authorization")
        void testUserAuthorization() {
            // Arrange
            when(authentication.isAuthenticated()).thenReturn(false);

            // Act & Assert
            PaymentRequest request = createTestPaymentRequest();
            assertThrows(UnauthorizedAccessException.class, () -> 
                paymentService.processPayment(request)
            );
        }
    }

    @Nested
    @DisplayName("Concurrent Processing Tests")
    class ConcurrentProcessingTests {

        @Test
        @DisplayName("Should handle concurrent payment requests")
        void testConcurrentPaymentProcessing() throws Exception {
            // Arrange
            int concurrentRequests = 10;
            ExecutorService executor = Executors.newFixedThreadPool(concurrentRequests);
            List<CompletableFuture<PaymentResponse>> futures = IntStream.range(0, concurrentRequests)
                .mapToObj(i -> CompletableFuture.supplyAsync(() -> {
                    PaymentRequest request = createTestPaymentRequest();
                    return paymentService.processPayment(request);
                }, executor))
                .toList();

            // Act
            CompletableFuture.allOf(futures.toArray(new CompletableFuture[0])).join();

            // Assert
            verify(paymentRepository, times(concurrentRequests)).save(any(Payment.class));
            executor.shutdown();
        }
    }

    @Nested
    @DisplayName("Payment History Tests")
    class PaymentHistoryTests {

        @Test
        @DisplayName("Should retrieve paginated payment history")
        void testPaymentHistoryRetrieval() {
            // Arrange
            LocalDateTime startDate = LocalDateTime.now().minusDays(30);
            LocalDateTime endDate = LocalDateTime.now();
            Pageable pageable = PageRequest.of(0, 20);
            Page<Payment> mockPage = mock(Page.class);
            when(paymentRepository.findByStatusAndDateRange(
                any(), any(), any(), any()
            )).thenReturn(mockPage);

            // Act
            Page<Payment> result = paymentService.getPaymentHistory(
                PaymentStatus.SUCCESS,
                startDate,
                endDate,
                pageable
            );

            // Assert
            assertNotNull(result);
            verify(paymentRepository).findByStatusAndDateRange(
                PaymentStatus.SUCCESS,
                startDate,
                endDate,
                pageable
            );
        }
    }

    @Nested
    @DisplayName("Refund Processing Tests")
    class RefundProcessingTests {

        @Test
        @DisplayName("Should successfully process refund")
        void testSuccessfulRefund() {
            // Arrange
            UUID paymentId = UUID.randomUUID();
            Payment payment = createTestPayment(PaymentStatus.SUCCESS);
            RefundRequest refundRequest = createTestRefundRequest();
            when(paymentRepository.findById(paymentId)).thenReturn(Optional.of(payment));
            when(stripeIntegration.refundPayment(any(), any()))
                .thenReturn(createSuccessfulRefundResponse());

            // Act
            RefundResponse response = paymentService.refundPayment(paymentId, refundRequest);

            // Assert
            assertNotNull(response);
            assertEquals(RefundStatus.SUCCESS, response.getStatus());
            verify(paymentRepository).save(argThat(p -> 
                p.getStatus() == PaymentStatus.REFUNDED
            ));
        }
    }

    // Helper methods
    private PaymentRequest createTestPaymentRequest() {
        return PaymentRequest.builder()
            .orderId(TEST_ORDER_ID)
            .amount(100.00)
            .currency(TEST_CURRENCY)
            .paymentMethodToken("test_token")
            .build();
    }

    private PaymentResponse createSuccessfulPaymentResponse() {
        return PaymentResponse.builder()
            .status(PaymentStatus.SUCCESS)
            .transactionId(UUID.randomUUID().toString())
            .amount(100.00)
            .currency(TEST_CURRENCY)
            .build();
    }

    private Payment createTestPayment(PaymentStatus status) {
        Payment payment = new Payment();
        payment.setId(UUID.randomUUID());
        payment.setOrderId(TEST_ORDER_ID);
        payment.setAmount(100.00);
        payment.setCurrency(TEST_CURRENCY);
        payment.setStatus(status);
        payment.setCreatedBy(TEST_USER);
        return payment;
    }

    private RefundRequest createTestRefundRequest() {
        return RefundRequest.builder()
            .amount(100.00)
            .reason(RefundReason.REQUESTED_BY_CUSTOMER)
            .build();
    }

    private RefundResponse createSuccessfulRefundResponse() {
        return RefundResponse.builder()
            .status(RefundStatus.SUCCESS)
            .refundId(UUID.randomUUID().toString())
            .amount(100.00)
            .currency(TEST_CURRENCY)
            .build();
    }
}