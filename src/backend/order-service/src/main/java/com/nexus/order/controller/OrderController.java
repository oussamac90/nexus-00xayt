package com.nexus.order.controller;

import com.nexus.order.model.Order;
import com.nexus.order.service.OrderService;
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import io.github.resilience4j.ratelimiter.annotation.RateLimiter;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Counter;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.security.SecurityScheme;
import io.swagger.v3.oas.annotations.enums.SecuritySchemeType;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

/**
 * REST controller implementing secure B2B trade order management endpoints.
 * Provides comprehensive order processing with validation, monitoring, and EDIFACT support.
 *
 * @version 1.0
 * @since 2023-09-01
 */
@RestController
@RequestMapping("/api/v1/orders")
@Slf4j
@Validated
@SecurityScheme(
    name = "bearerAuth",
    type = SecuritySchemeType.HTTP,
    scheme = "bearer",
    bearerFormat = "JWT"
)
@Tag(name = "Orders", description = "Order management endpoints")
public class OrderController {

    private static final int EDIFACT_MAX_SIZE = 10485760; // 10MB limit for EDIFACT messages

    private final OrderService orderService;
    private final MeterRegistry meterRegistry;
    private final Counter orderCreationCounter;
    private final Counter edifactProcessingCounter;

    /**
     * Initializes the order controller with required dependencies.
     *
     * @param orderService Service layer for order operations
     * @param meterRegistry Metrics registry for monitoring
     */
    public OrderController(OrderService orderService, MeterRegistry meterRegistry) {
        this.orderService = orderService;
        this.meterRegistry = meterRegistry;
        
        // Initialize metrics
        this.orderCreationCounter = Counter.builder("orders.creation.total")
            .description("Total number of order creation attempts")
            .register(meterRegistry);
            
        this.edifactProcessingCounter = Counter.builder("orders.edifact.processing.total")
            .description("Total number of EDIFACT message processing attempts")
            .register(meterRegistry);
    }

    /**
     * Creates a new order with comprehensive validation.
     *
     * @param order Order details to create
     * @return Created order with security headers
     */
    @PostMapping
    @Operation(
        summary = "Create new order",
        security = @SecurityRequirement(name = "bearerAuth")
    )
    @RateLimiter(name = "orderCreation")
    @CircuitBreaker(name = "orderService")
    public ResponseEntity<Order> createOrder(@Valid @RequestBody Order order) {
        log.info("Creating new order for buyer: {}", order.getBuyerId());
        orderCreationCounter.increment();

        Order createdOrder = orderService.createOrder(order);

        HttpHeaders headers = new HttpHeaders();
        headers.add("X-Content-Type-Options", "nosniff");
        headers.add("X-Frame-Options", "DENY");
        headers.add("X-XSS-Protection", "1; mode=block");

        log.info("Order created successfully: {}", createdOrder.getOrderNumber());
        return ResponseEntity.ok().headers(headers).body(createdOrder);
    }

    /**
     * Updates order status with validation and audit logging.
     *
     * @param orderNumber Order number to update
     * @param status New status value
     * @return Updated order
     */
    @PutMapping("/{orderNumber}/status")
    @Operation(
        summary = "Update order status",
        security = @SecurityRequirement(name = "bearerAuth")
    )
    @CircuitBreaker(name = "orderService")
    public ResponseEntity<Order> updateOrderStatus(
            @PathVariable String orderNumber,
            @Valid @RequestParam String status) {
        log.info("Updating status for order: {} to: {}", orderNumber, status);
        
        Order updatedOrder = orderService.updateOrderStatus(orderNumber, status);
        
        HttpHeaders headers = new HttpHeaders();
        headers.add("X-Content-Type-Options", "nosniff");
        
        log.info("Order status updated successfully: {}", orderNumber);
        return ResponseEntity.ok().headers(headers).body(updatedOrder);
    }

    /**
     * Retrieves order by order number with caching support.
     *
     * @param orderNumber Order number to retrieve
     * @return Order if found
     */
    @GetMapping("/{orderNumber}")
    @Operation(
        summary = "Get order by number",
        security = @SecurityRequirement(name = "bearerAuth")
    )
    @CircuitBreaker(name = "orderService")
    public ResponseEntity<Order> getOrder(@PathVariable String orderNumber) {
        log.debug("Retrieving order: {}", orderNumber);
        
        return orderService.getOrderByNumber(orderNumber)
            .map(order -> {
                HttpHeaders headers = new HttpHeaders();
                headers.add("X-Content-Type-Options", "nosniff");
                return ResponseEntity.ok().headers(headers).body(order);
            })
            .orElse(ResponseEntity.notFound().build());
    }

    /**
     * Retrieves orders for a specific buyer with pagination.
     *
     * @param buyerId Buyer's UUID
     * @param pageable Pagination parameters
     * @return Page of orders for the buyer
     */
    @GetMapping("/buyer/{buyerId}")
    @Operation(
        summary = "Get buyer orders",
        security = @SecurityRequirement(name = "bearerAuth")
    )
    @CircuitBreaker(name = "orderService")
    public ResponseEntity<Page<Order>> getBuyerOrders(
            @PathVariable UUID buyerId,
            @Parameter(description = "Pagination parameters") Pageable pageable) {
        log.debug("Retrieving orders for buyer: {}", buyerId);
        
        Page<Order> orders = orderService.getBuyerOrders(buyerId, pageable);
        
        HttpHeaders headers = new HttpHeaders();
        headers.add("X-Content-Type-Options", "nosniff");
        
        return ResponseEntity.ok().headers(headers).body(orders);
    }

    /**
     * Retrieves orders for a specific seller with pagination.
     *
     * @param sellerId Seller's UUID
     * @param pageable Pagination parameters
     * @return Page of orders for the seller
     */
    @GetMapping("/seller/{sellerId}")
    @Operation(
        summary = "Get seller orders",
        security = @SecurityRequirement(name = "bearerAuth")
    )
    @CircuitBreaker(name = "orderService")
    public ResponseEntity<Page<Order>> getSellerOrders(
            @PathVariable UUID sellerId,
            @Parameter(description = "Pagination parameters") Pageable pageable) {
        log.debug("Retrieving orders for seller: {}", sellerId);
        
        Page<Order> orders = orderService.getSellerOrders(sellerId, pageable);
        
        HttpHeaders headers = new HttpHeaders();
        headers.add("X-Content-Type-Options", "nosniff");
        
        return ResponseEntity.ok().headers(headers).body(orders);
    }

    /**
     * Processes incoming EDIFACT order message with size validation.
     *
     * @param edifactMessage EDIFACT message to process
     * @return Created order
     */
    @PostMapping("/edifact")
    @Operation(
        summary = "Process EDIFACT order",
        security = @SecurityRequirement(name = "bearerAuth")
    )
    @CircuitBreaker(name = "orderService")
    public ResponseEntity<Order> processEdifactOrder(
            @Valid @RequestBody String edifactMessage) {
        log.info("Processing EDIFACT order message");
        edifactProcessingCounter.increment();

        if (edifactMessage == null || edifactMessage.length() > EDIFACT_MAX_SIZE) {
            log.error("Invalid EDIFACT message size");
            return ResponseEntity.badRequest().build();
        }

        Order processedOrder = orderService.processEdifactOrder(edifactMessage);
        
        HttpHeaders headers = new HttpHeaders();
        headers.add("X-Content-Type-Options", "nosniff");
        headers.add("X-Frame-Options", "DENY");
        
        log.info("EDIFACT order processed successfully: {}", processedOrder.getOrderNumber());
        return ResponseEntity.ok().headers(headers).body(processedOrder);
    }
}