package com.nexus.product.model;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.nexus.common.model.BaseEntity;
import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.math.BigDecimal;

/**
 * Entity class representing a product in the B2B trade platform with comprehensive
 * support for B2B trade attributes, eCl@ss classification, and GS1 identification.
 *
 * @version 1.0
 * @since 2023-09-01
 */
@Entity
@Table(name = "products", indexes = {
    @Index(name = "idx_product_sku", columnList = "sku"),
    @Index(name = "idx_product_gtin", columnList = "gtin"),
    @Index(name = "idx_product_eclass", columnList = "eclass_code"),
    @Index(name = "idx_product_org", columnList = "organization_id")
})
@Data
@EqualsAndHashCode(callSuper = true)
public class Product extends BaseEntity {

    @NotNull
    @Size(min = 3, max = 50)
    @Pattern(regexp = "^[A-Za-z0-9-_]+$")
    @Column(name = "sku", nullable = false, unique = true)
    private String sku;

    @NotNull
    @Size(min = 1, max = 255)
    @Column(name = "name", nullable = false)
    private String name;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @Pattern(regexp = "^[0-9]{14}$")
    @Column(name = "gtin", length = 14)
    private String gtin;

    @Pattern(regexp = "^[0-9]{8}$")
    @Column(name = "eclass_code", length = 8)
    private String eclassCode;

    @NotNull
    @Column(name = "price", nullable = false, precision = 19, scale = 4)
    private BigDecimal price;

    @NotNull
    @Pattern(regexp = "^[A-Z]{3}$")
    @Column(name = "currency", nullable = false, length = 3)
    private String currency;

    @NotNull
    @Column(name = "min_order_quantity", nullable = false)
    private Integer minOrderQuantity;

    @NotNull
    @Size(min = 1, max = 10)
    @Column(name = "unit", nullable = false)
    private String unit;

    @NotNull
    @Column(name = "active", nullable = false)
    private Boolean active;

    @Column(name = "attributes", columnDefinition = "jsonb")
    private JsonNode attributes;

    @Column(name = "specifications", columnDefinition = "jsonb")
    private JsonNode specifications;

    @Column(name = "dimensions", columnDefinition = "jsonb")
    private JsonNode dimensions;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "organization_id", nullable = false)
    private Organization organization;

    /**
     * Default constructor initializing a new product with default values.
     */
    public Product() {
        super();
        this.active = true;
        this.minOrderQuantity = 1;
        this.currency = "USD";
        this.attributes = JsonNodeFactory.instance.objectNode();
        this.specifications = JsonNodeFactory.instance.objectNode();
        this.dimensions = JsonNodeFactory.instance.objectNode();
    }

    /**
     * Validates GTIN format and checksum according to GS1 specifications.
     *
     * @return true if GTIN is valid according to GS1 standards
     */
    public boolean validateGTIN() {
        if (gtin == null || !gtin.matches("^[0-9]{14}$")) {
            return false;
        }

        int sum = 0;
        for (int i = 0; i < 13; i++) {
            int digit = Character.getNumericValue(gtin.charAt(i));
            sum += digit * (i % 2 == 0 ? 1 : 3);
        }

        int checkDigit = (10 - (sum % 10)) % 10;
        return checkDigit == Character.getNumericValue(gtin.charAt(13));
    }

    /**
     * Validates eCl@ss product classification code format and version.
     *
     * @return true if eCl@ss code is valid
     */
    public boolean validateEclassCode() {
        if (eclassCode == null || !eclassCode.matches("^[0-9]{8}$")) {
            return false;
        }

        // Version check (first two digits represent version)
        int version = Integer.parseInt(eclassCode.substring(0, 2));
        return version >= 10 && version <= 12; // Supporting versions 10.0 through 12.0
    }

    /**
     * Updates the product specifications while maintaining the JSON structure.
     *
     * @param specifications New specifications as JsonNode
     */
    public void updateSpecifications(JsonNode specifications) {
        if (specifications != null && specifications.isObject()) {
            this.specifications = specifications;
        }
    }

    /**
     * Updates the product dimensions with validation.
     *
     * @param dimensions New dimensions as JsonNode
     */
    public void updateDimensions(JsonNode dimensions) {
        if (dimensions != null && dimensions.isObject()) {
            this.dimensions = dimensions;
        }
    }

    /**
     * Updates the product attributes while maintaining the JSON structure.
     *
     * @param attributes New attributes as JsonNode
     */
    public void updateAttributes(JsonNode attributes) {
        if (attributes != null && attributes.isObject()) {
            this.attributes = attributes;
        }
    }
}