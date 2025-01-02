package com.nexus.shipping.repository;

import com.nexus.shipping.model.Shipment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Repository interface for managing Shipment entities in the Nexus platform.
 * Provides optimized data access methods with support for complex queries and specification-based filtering.
 * Leverages database indexes for efficient retrieval patterns.
 *
 * @version 1.0
 * @since 2023-09-01
 */
public interface ShipmentRepository extends JpaRepository<Shipment, UUID>, JpaSpecificationExecutor<Shipment> {

    /**
     * Finds a shipment by its tracking number using an optimized index scan.
     * Leverages the idx_tracking index defined in the Shipment entity.
     *
     * @param trackingNumber the tracking number to search for
     * @return Optional containing the shipment if found, empty if not exists
     */
    @Query("SELECT s FROM Shipment s WHERE s.trackingNumber = :trackingNumber AND s.deleted = false")
    Optional<Shipment> findByTrackingNumber(@Param("trackingNumber") String trackingNumber);

    /**
     * Retrieves all shipments associated with an order using efficient index scanning.
     * Leverages the idx_order index defined in the Shipment entity.
     * Results are ordered by creation date to show most recent shipments first.
     *
     * @param orderId the UUID of the order to find shipments for
     * @return List of shipments for the order, empty list if none found
     */
    @Query("SELECT s FROM Shipment s WHERE s.orderId = :orderId AND s.deleted = false ORDER BY s.createdAt DESC")
    List<Shipment> findByOrderId(@Param("orderId") UUID orderId);

    /**
     * Finds all shipments with a specific status using optimized filtering.
     * Results are ordered by last update time to show most recently updated shipments first.
     *
     * @param status the shipment status to filter by
     * @return List of shipments with the specified status, empty list if none found
     */
    @Query("SELECT s FROM Shipment s WHERE s.status = :status AND s.deleted = false ORDER BY s.updatedAt DESC")
    List<Shipment> findByStatus(@Param("status") String status);

    /**
     * Finds shipments by carrier and status with compound filtering optimization.
     * Results are ordered by last update time to show most recently updated shipments first.
     *
     * @param carrier the carrier to filter by
     * @param status the shipment status to filter by
     * @return List of shipments matching carrier and status criteria, empty list if none found
     */
    @Query("SELECT s FROM Shipment s WHERE s.carrier = :carrier AND s.status = :status AND s.deleted = false ORDER BY s.updatedAt DESC")
    List<Shipment> findByCarrierAndStatus(@Param("carrier") String carrier, @Param("status") String status);

    /**
     * Finds all active shipments for a specific service level.
     * Results are ordered by estimated delivery date to prioritize upcoming deliveries.
     *
     * @param serviceLevel the service level to filter by
     * @return List of shipments with the specified service level, empty list if none found
     */
    @Query("SELECT s FROM Shipment s WHERE s.serviceLevel = :serviceLevel AND s.deleted = false ORDER BY s.estimatedDeliveryDate ASC")
    List<Shipment> findByServiceLevel(@Param("serviceLevel") String serviceLevel);

    /**
     * Retrieves all undelivered shipments for a specific carrier ordered by creation date.
     * Useful for carrier-specific shipment processing and monitoring.
     *
     * @param carrier the carrier to filter by
     * @return List of undelivered shipments for the carrier, empty list if none found
     */
    @Query("SELECT s FROM Shipment s WHERE s.carrier = :carrier AND s.status != 'DELIVERED' AND s.deleted = false ORDER BY s.createdAt ASC")
    List<Shipment> findUndeliveredByCarrier(@Param("carrier") String carrier);
}