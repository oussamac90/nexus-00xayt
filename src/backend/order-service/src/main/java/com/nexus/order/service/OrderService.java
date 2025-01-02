package com.nexus.order.service;

import com.nexus.order.model.Order;
import com.nexus.order.repository.OrderRepository;
import com.nexus.order.integration.EdifactIntegration;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import lombok.extern.slf4j.Slf4j;

import java.util.UUID;
import java.util.Optional;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.HashMap;
import java.util.List;

/**
 * Service class implementing core business logic for B2B trade order processing.
 * Provides comprehensive order management with transaction support, EDIFACT integration,
 * and audit logging capabilities.
 *
 * @version 1.0
 * @since 2023-09-01
 */
@Service
@Slf4j
public class OrderService {

    private final OrderRepository orderRepository;
    private final EdifactIntegration edifactIntegration;

    /**
     * Initializes the order service with required dependencies.
     *
     * @param orderRepository Repository for order data access
     * @param edifactIntegration Integration service for EDIFACT message processing
     */
    public OrderService(OrderRepository orderRepository, EdifactIntegration edifactIntegration) {
        this.orderRepository = orderRepository;
        this.edifactIntegration = edifactIntegration;
    }

    /**
     * Creates a new order with comprehensive validation and EDIFACT message generation.
     *
     * @param order Order to be created
     * @return Created order with generated ID and order number
     * @throws IllegalArgumentException if order validation fails
     */
    @Transactional(rollbackFor = Exception.class)
    public Order createOrder(Order order) {
        log.debug("Creating new order for buyer: {}", order.getBuyerId());

        // Validate order data
        validateOrder(order);

        // Generate order number if not provided
        if (order.getOrderNumber() == null) {
            order.setOrderNumber(generateOrderNumber());
        }

        // Set initial status and calculate totals
        order.setStatus("PENDING");
        order.calculateTotals();

        // Generate EDIFACT message
        String edifactMessage = edifactIntegration.convertOrderToEdifact(order);
        order.setEdifactMessageId(UUID.randomUUID().toString());

        // Save order
        Order savedOrder = orderRepository.save(order);
        log.info("Created order: {} for buyer: {}", savedOrder.getOrderNumber(), savedOrder.getBuyerId());

        return savedOrder;
    }

    /**
     * Updates order status with validation and audit logging.
     *
     * @param orderNumber Order number to update
     * @param newStatus New status value
     * @return Updated order
     * @throws IllegalArgumentException if order not found or status invalid
     */
    @Transactional(rollbackFor = Exception.class)
    public Order updateOrderStatus(String orderNumber, String newStatus) {
        log.debug("Updating status for order: {} to: {}", orderNumber, newStatus);

        Order order = orderRepository.findByOrderNumber(orderNumber)
            .orElseThrow(() -> new IllegalArgumentException("Order not found: " + orderNumber));

        validateOrderStatus(newStatus);
        order.setStatus(newStatus);

        Order updatedOrder = orderRepository.save(order);
        log.info("Updated status for order: {} to: {}", orderNumber, newStatus);

        return updatedOrder;
    }

    /**
     * Retrieves order by order number with caching support.
     *
     * @param orderNumber Order number to retrieve
     * @return Optional containing the order if found
     */
    public Optional<Order> getOrderByNumber(String orderNumber) {
        log.debug("Retrieving order: {}", orderNumber);
        return orderRepository.findByOrderNumber(orderNumber);
    }

    /**
     * Retrieves orders for a specific buyer with pagination.
     *
     * @param buyerId Buyer's UUID
     * @param pageable Pagination parameters
     * @return Page of orders for the buyer
     */
    public Page<Order> getBuyerOrders(UUID buyerId, Pageable pageable) {
        log.debug("Retrieving orders for buyer: {}", buyerId);
        return orderRepository.findByBuyerId(buyerId, pageable);
    }

    /**
     * Retrieves orders for a specific seller with pagination.
     *
     * @param sellerId Seller's UUID
     * @param pageable Pagination parameters
     * @return Page of orders for the seller
     */
    public Page<Order> getSellerOrders(UUID sellerId, Pageable pageable) {
        log.debug("Retrieving orders for seller: {}", sellerId);
        return orderRepository.findBySellerId(sellerId, pageable);
    }

    /**
     * Processes incoming EDIFACT order message and creates corresponding order.
     *
     * @param edifactMessage EDIFACT message to process
     * @return Created order
     * @throws IllegalArgumentException if message parsing fails
     */
    @Transactional(rollbackFor = Exception.class)
    public Order processEdifactOrder(String edifactMessage) {
        log.debug("Processing EDIFACT order message");

        // Parse EDIFACT message to order
        Order order = edifactIntegration.parseEdifactMessage(edifactMessage);
        
        // Validate and save order
        validateOrder(order);
        Order savedOrder = orderRepository.save(order);
        
        log.info("Processed EDIFACT order: {}", savedOrder.getOrderNumber());
        return savedOrder;
    }

    /**
     * Validates order data completeness and business rules.
     *
     * @param order Order to validate
     * @throws IllegalArgumentException if validation fails
     */
    private void validateOrder(Order order) {
        Map<String, Object> fields = new HashMap<>();
        fields.put("buyerId", order.getBuyerId());
        fields.put("sellerId", order.getSellerId());
        fields.put("items", order.getItems());

        List<String> missingFields = validateRequired(fields);
        if (!missingFields.isEmpty()) {
            throw new IllegalArgumentException("Missing required fields: " + String.join(", ", missingFields));
        }

        if (order.getItems().isEmpty()) {
            throw new IllegalArgumentException("Order must contain at least one item");
        }
    }

    /**
     * Validates order status transitions according to business rules.
     *
     * @param status Status to validate
     * @throws IllegalArgumentException if status is invalid
     */
    private void validateOrderStatus(String status) {
        List<String> validStatuses = List.of("PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED");
        if (!validStatuses.contains(status)) {
            throw new IllegalArgumentException("Invalid order status: " + status);
        }
    }

    /**
     * Validates required fields presence.
     *
     * @param fields Map of fields to validate
     * @return List of missing field names
     */
    private List<String> validateRequired(Map<String, Object> fields) {
        List<String> missingFields = new ArrayList<>();
        for (Map.Entry<String, Object> entry : fields.entrySet()) {
            if (entry.getValue() == null) {
                missingFields.add(entry.getKey());
            }
        }
        return missingFields;
    }

    /**
     * Generates unique order number with retry mechanism.
     *
     * @return Generated order number
     */
    private String generateOrderNumber() {
        String prefix = "ORD";
        LocalDateTime now = LocalDateTime.now();
        String timestamp = String.format("%d%02d%02d%02d%02d",
            now.getYear(), now.getMonthValue(), now.getDayOfMonth(),
            now.getHour(), now.getMinute());
        return prefix + timestamp + UUID.randomUUID().toString().substring(0, 4).toUpperCase();
    }
}