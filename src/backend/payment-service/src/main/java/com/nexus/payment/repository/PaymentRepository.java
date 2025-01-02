package com.nexus.payment.repository;

import com.nexus.common.model.BaseEntity;
import com.nexus.payment.model.Payment;
import com.nexus.payment.model.PaymentStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Repository interface for Payment entity providing secure and efficient data access methods.
 * Implements PCI DSS compliant data access patterns and optimized query performance.
 *
 * @version 1.0
 * @since 2023-09-01
 */
@Repository
public interface PaymentRepository extends JpaRepository<Payment, UUID> {

    /**
     * Retrieves all payments associated with a specific order with optimized query performance.
     * Uses composite index on orderId and createdAt for efficient retrieval.
     *
     * @param orderId the UUID of the order
     * @return list of payments associated with the order, ordered by creation date descending
     */
    @Query("SELECT p FROM Payment p WHERE p.orderId = :orderId AND p.deleted = false " +
           "ORDER BY p.createdAt DESC")
    List<Payment> findByOrderId(@Param("orderId") UUID orderId);

    /**
     * Finds a specific payment by its unique transaction ID with secure access pattern.
     * Implements PCI DSS compliant data access with audit logging.
     *
     * @param transactionId the unique transaction identifier
     * @return Optional containing payment if found, empty if not exists
     */
    @Query("SELECT p FROM Payment p WHERE p.transactionId = :transactionId AND p.deleted = false")
    Optional<Payment> findByTransactionId(@Param("transactionId") String transactionId);

    /**
     * Retrieves paginated payments filtered by status and date range for reporting and reconciliation.
     * Uses composite index on status and createdAt for optimized performance.
     *
     * @param status the payment status to filter by
     * @param startDate the start of the date range
     * @param endDate the end of the date range
     * @param pageable pagination and sorting parameters
     * @return paginated payment records matching criteria
     */
    @Query("SELECT p FROM Payment p WHERE p.status = :status " +
           "AND p.createdAt BETWEEN :startDate AND :endDate " +
           "AND p.deleted = false")
    Page<Payment> findByStatusAndDateRange(
            @Param("status") PaymentStatus status,
            @Param("startDate") LocalDateTime startDate,
            @Param("endDate") LocalDateTime endDate,
            Pageable pageable);

    /**
     * Retrieves all pending payments older than specified duration for timeout handling.
     * Implements index on status and createdAt for efficient timeout processing.
     *
     * @param status the payment status (typically PENDING)
     * @param cutoffTime the timestamp before which payments are considered timed out
     * @return list of payments that need timeout processing
     */
    @Query("SELECT p FROM Payment p WHERE p.status = :status " +
           "AND p.createdAt < :cutoffTime AND p.deleted = false")
    List<Payment> findTimeoutCandidates(
            @Param("status") PaymentStatus status,
            @Param("cutoffTime") LocalDateTime cutoffTime);

    /**
     * Finds all payments requiring reconciliation within a specific date range.
     * Uses composite index on reconciliationStatus and createdAt for optimized retrieval.
     *
     * @param startDate the start of the reconciliation period
     * @param endDate the end of the reconciliation period
     * @param pageable pagination and sorting parameters
     * @return paginated payment records needing reconciliation
     */
    @Query("SELECT p FROM Payment p WHERE p.reconciliationStatus = 'PENDING' " +
           "AND p.createdAt BETWEEN :startDate AND :endDate " +
           "AND p.deleted = false")
    Page<Payment> findPaymentsForReconciliation(
            @Param("startDate") LocalDateTime startDate,
            @Param("endDate") LocalDateTime endDate,
            Pageable pageable);
}