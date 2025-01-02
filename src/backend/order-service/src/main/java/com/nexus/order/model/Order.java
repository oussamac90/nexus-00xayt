package com.nexus.order.model;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.nexus.common.model.BaseEntity;
import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Entity class representing a comprehensive B2B trade order in the Nexus platform.
 * Manages complete order lifecycle, product items, multi-currency pricing,
 * international shipping details, payment processing, and EDIFACT message integration.
 *
 * @version 1.0
 * @since 2023-09-01
 */
@Entity
@Table(name = "orders", indexes = {
    @Index(name = "idx_order_number", columnList = "orderNumber"),
    @Index(name = "idx_buyer_seller", columnList = "buyerId,sellerId"),
    @Index(name = "idx_status_date", columnList = "status,orderDate")
})
@Data
@EqualsAndHashCode(callSuper = true)
public class Order extends BaseEntity {

    @NotNull(message = "Order number is required")
    @Column(name = "order_number", nullable = false, unique = true)
    private String orderNumber;

    @NotNull(message = "Order status is required")
    @Column(name = "status", nullable = false)
    private String status;

    @NotNull(message = "Order date is required")
    @Column(name = "order_date", nullable = false)
    private LocalDateTime orderDate;

    @Column(name = "subtotal", precision = 19, scale = 4, nullable = false)
    private BigDecimal subtotal;

    @Column(name = "tax", precision = 19, scale = 4, nullable = false)
    private BigDecimal tax;

    @Column(name = "shipping", precision = 19, scale = 4, nullable = false)
    private BigDecimal shipping;

    @Column(name = "total", precision = 19, scale = 4, nullable = false)
    private BigDecimal total;

    @NotNull(message = "Currency is required")
    @Column(name = "currency", length = 3, nullable = false)
    private String currency;

    @NotNull(message = "Payment status is required")
    @Column(name = "payment_status", nullable = false)
    private String paymentStatus;

    @Column(name = "payment_method")
    private String paymentMethod;

    @Column(name = "shipping_method")
    private String shippingMethod;

    @Column(name = "shipping_address", columnDefinition = "jsonb")
    private JsonNode shippingAddress;

    @Column(name = "billing_address", columnDefinition = "jsonb")
    private JsonNode billingAddress;

    @Column(name = "edifact_message_id")
    private String edifactMessageId;

    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<OrderItem> items;

    @NotNull(message = "Buyer ID is required")
    @Column(name = "buyer_id", nullable = false)
    private UUID buyerId;

    @NotNull(message = "Seller ID is required")
    @Column(name = "seller_id", nullable = false)
    private UUID sellerId;

    @Column(name = "metadata", columnDefinition = "jsonb")
    private JsonNode metadata;

    private static final ObjectMapper objectMapper = new ObjectMapper();

    /**
     * Default constructor initializing a new order with default values.
     */
    public Order() {
        super();
        this.orderDate = LocalDateTime.now();
        this.status = "DRAFT";
        this.paymentStatus = "PENDING";
        this.items = new ArrayList<>();
        this.shippingAddress = objectMapper.createObjectNode();
        this.billingAddress = objectMapper.createObjectNode();
        this.metadata = objectMapper.createObjectNode();
        this.currency = "USD"; // Default currency
        this.subtotal = BigDecimal.ZERO;
        this.tax = BigDecimal.ZERO;
        this.shipping = BigDecimal.ZERO;
        this.total = BigDecimal.ZERO;
    }

    /**
     * Calculates order totals including subtotal, tax, shipping, and final total.
     * Applies tax rules based on shipping address and handles currency conversion.
     */
    public void calculateTotals() {
        this.subtotal = items.stream()
            .map(item -> item.getUnitPrice().multiply(new BigDecimal(item.getQuantity())))
            .reduce(BigDecimal.ZERO, BigDecimal::add);

        // Apply tax rules based on shipping address
        if (this.shippingAddress != null && this.shippingAddress.has("countryCode")) {
            String countryCode = this.shippingAddress.get("countryCode").asText();
            this.tax = calculateTaxForCountry(this.subtotal, countryCode);
        }

        // Calculate shipping cost based on method and address
        this.shipping = calculateShippingCost();

        // Calculate final total
        this.total = this.subtotal.add(this.tax).add(this.shipping);
    }

    /**
     * Adds a new item to the order and recalculates totals.
     *
     * @param item The order item to add
     * @throws IllegalArgumentException if item validation fails
     */
    public void addItem(OrderItem item) {
        if (item == null) {
            throw new IllegalArgumentException("Order item cannot be null");
        }

        item.setOrder(this);
        this.items.add(item);
        calculateTotals();
    }

    /**
     * Generates a standardized EDIFACT message for the order.
     *
     * @return EDIFACT formatted message string
     * @throws IllegalStateException if order data is incomplete
     */
    public String generateEdifactMessage() {
        validateOrderCompleteness();
        
        StringBuilder edifact = new StringBuilder();
        String messageId = UUID.randomUUID().toString();
        
        // Build EDIFACT message according to D.01B standard
        edifact.append("UNH+").append(messageId).append("+ORDERS:D:01B:UN:EAN010'")
              .append("BGM+220+").append(this.orderNumber).append("+9'")
              .append("DTM+137:").append(this.orderDate).append(":203'")
              .append("NAD+BY+").append(this.buyerId).append("'")
              .append("NAD+SE+").append(this.sellerId).append("'");

        // Add items
        for (OrderItem item : items) {
            edifact.append("LIN+").append(item.getLineNumber())
                  .append("+").append(item.getProductSku())
                  .append(":EN'")
                  .append("QTY+21:").append(item.getQuantity()).append("'")
                  .append("MOA+203:").append(item.getUnitPrice()).append("'");
        }

        edifact.append("UNT+").append(items.size() * 3 + 5).append("+").append(messageId).append("'");
        
        this.edifactMessageId = messageId;
        return edifact.toString();
    }

    private BigDecimal calculateTaxForCountry(BigDecimal amount, String countryCode) {
        // Tax calculation logic based on country
        // Default to 0% if no specific rule exists
        return amount.multiply(getTaxRateForCountry(countryCode));
    }

    private BigDecimal calculateShippingCost() {
        // Shipping cost calculation based on method and address
        // Implement specific shipping calculation logic
        return BigDecimal.ZERO; // Placeholder
    }

    private BigDecimal getTaxRateForCountry(String countryCode) {
        // Implement country-specific tax rate logic
        return BigDecimal.ZERO; // Placeholder
    }

    private void validateOrderCompleteness() {
        if (this.buyerId == null || this.sellerId == null || this.items.isEmpty()) {
            throw new IllegalStateException("Order data is incomplete");
        }
    }
}