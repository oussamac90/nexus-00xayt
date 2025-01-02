package com.nexus.order.repository;

import com.nexus.order.model.Order;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.cache.annotation.Cacheable;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Repository interface for managing Order entities in the Nexus platform.
 * Provides comprehensive data access methods for B2B trade operations with
 * support for complex queries, pagination, and EDIFACT message integration.
 *
 * @version 1.0
 * @since 2023-09-01
 */
@Repository
public interface OrderRepository extends JpaRepository<Order, UUID>, JpaSpecificationExecutor<Order> {

    /**
     * Finds an order by its unique order number with caching support.
     *
     * @param orderNumber the unique order number
     * @return Optional containing the order if found
     */
    @Cacheable(value = "orderCache", key = "#orderNumber")
    @Query("SELECT o FROM Order o WHERE o.orderNumber = :orderNumber AND o.deleted = false")
    Optional<Order> findByOrderNumber(@Param("orderNumber") String orderNumber);

    /**
     * Retrieves all orders for a specific buyer with pagination support.
     *
     * @param buyerId the UUID of the buyer
     * @param pageable pagination information
     * @return Page of orders for the buyer
     */
    @Query("SELECT o FROM Order o WHERE o.buyerId = :buyerId AND o.deleted = false ORDER BY o.createdAt DESC")
    Page<Order> findByBuyerId(@Param("buyerId") UUID buyerId, Pageable pageable);

    /**
     * Retrieves all orders for a specific seller with pagination support.
     *
     * @param sellerId the UUID of the seller
     * @param pageable pagination information
     * @return Page of orders for the seller
     */
    @Query("SELECT o FROM Order o WHERE o.sellerId = :sellerId AND o.deleted = false ORDER BY o.createdAt DESC")
    Page<Order> findBySellerId(@Param("sellerId") UUID sellerId, Pageable pageable);

    /**
     * Retrieves orders with a specific status with pagination support.
     *
     * @param status the order status
     * @param pageable pagination information
     * @return Page of orders with the specified status
     */
    @Query("SELECT o FROM Order o WHERE o.status = :status AND o.deleted = false ORDER BY o.createdAt DESC")
    Page<Order> findByStatus(@Param("status") String status, Pageable pageable);

    /**
     * Finds an order by its EDIFACT message ID with caching support.
     *
     * @param edifactMessageId the EDIFACT message identifier
     * @return Optional containing the order if found
     */
    @Cacheable(value = "edifactCache", key = "#edifactMessageId")
    @Query("SELECT o FROM Order o WHERE o.edifactMessageId = :edifactMessageId AND o.deleted = false")
    Optional<Order> findByEdifactMessageId(@Param("edifactMessageId") String edifactMessageId);

    /**
     * Retrieves orders created within a date range with pagination support.
     *
     * @param startDate start of the date range
     * @param endDate end of the date range
     * @param pageable pagination information
     * @return Page of orders within the date range
     */
    @Query("SELECT o FROM Order o WHERE o.orderDate BETWEEN :startDate AND :endDate " +
           "AND o.deleted = false ORDER BY o.orderDate DESC")
    Page<Order> findByOrderDateBetween(
        @Param("startDate") LocalDateTime startDate,
        @Param("endDate") LocalDateTime endDate,
        Pageable pageable
    );

    /**
     * Finds orders by payment status with pagination support.
     *
     * @param paymentStatus the payment status
     * @param pageable pagination information
     * @return Page of orders with the specified payment status
     */
    @Query("SELECT o FROM Order o WHERE o.paymentStatus = :paymentStatus " +
           "AND o.deleted = false ORDER BY o.createdAt DESC")
    Page<Order> findByPaymentStatus(@Param("paymentStatus") String paymentStatus, Pageable pageable);

    /**
     * Retrieves orders for a specific buyer and status combination.
     *
     * @param buyerId the UUID of the buyer
     * @param status the order status
     * @param pageable pagination information
     * @return Page of matching orders
     */
    @Query("SELECT o FROM Order o WHERE o.buyerId = :buyerId AND o.status = :status " +
           "AND o.deleted = false ORDER BY o.createdAt DESC")
    Page<Order> findByBuyerIdAndStatus(
        @Param("buyerId") UUID buyerId,
        @Param("status") String status,
        Pageable pageable
    );

    /**
     * Retrieves orders for a specific seller and status combination.
     *
     * @param sellerId the UUID of the seller
     * @param status the order status
     * @param pageable pagination information
     * @return Page of matching orders
     */
    @Query("SELECT o FROM Order o WHERE o.sellerId = :sellerId AND o.status = :status " +
           "AND o.deleted = false ORDER BY o.createdAt DESC")
    Page<Order> findBySellerIdAndStatus(
        @Param("sellerId") UUID sellerId,
        @Param("status") String status,
        Pageable pageable
    );

    /**
     * Counts active orders for a specific buyer.
     *
     * @param buyerId the UUID of the buyer
     * @return count of active orders
     */
    @Query("SELECT COUNT(o) FROM Order o WHERE o.buyerId = :buyerId AND o.deleted = false")
    long countByBuyerId(@Param("buyerId") UUID buyerId);

    /**
     * Counts active orders for a specific seller.
     *
     * @param sellerId the UUID of the seller
     * @return count of active orders
     */
    @Query("SELECT COUNT(o) FROM Order o WHERE o.sellerId = :sellerId AND o.deleted = false")
    long countBySellerId(@Param("sellerId") UUID sellerId);
}