package com.nexus.user.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.JsonNode;
import com.nexus.common.model.BaseEntity;
import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.Set;

/**
 * Entity class representing an organization/company in the B2B trade platform.
 * Implements comprehensive data management and security features for enterprise-grade operations.
 *
 * @version 1.0
 * @since 2023-09-01
 */
@Entity
@Table(name = "organizations", indexes = {
    @Index(name = "idx_org_tax_id", columnList = "tax_id"),
    @Index(name = "idx_org_reg_num", columnList = "registration_number")
})
@Data
@EqualsAndHashCode(callSuper = true)
@JsonIgnoreProperties(ignoreUnknown = true)
public class Organization extends BaseEntity {

    @NotNull
    @Size(min = 2, max = 255)
    @Column(name = "name", nullable = false)
    private String name;

    @NotNull
    @Pattern(regexp = "^[A-Z0-9]{5,20}$", message = "Tax ID must be 5-20 alphanumeric characters")
    @Column(name = "tax_id", nullable = false, unique = true)
    private String taxId;

    @NotNull
    @Pattern(regexp = "^[A-Z0-9-]{5,30}$", message = "Registration number must be 5-30 characters")
    @Column(name = "registration_number", nullable = false, unique = true)
    private String registrationNumber;

    @Size(max = 255)
    @Column(name = "website")
    private String website;

    @Pattern(regexp = "^\\+?[1-9][0-9]{7,14}$")
    @Column(name = "phone")
    private String phone;

    @Size(max = 500)
    @Column(name = "address", length = 500)
    private String address;

    @NotNull
    @Size(min = 2, max = 2)
    @Column(name = "country", nullable = false)
    private String country;

    @NotNull
    @Size(max = 100)
    @Column(name = "industry", nullable = false)
    private String industry;

    @Column(name = "verified", nullable = false)
    private Boolean verified;

    @Column(name = "verified_at")
    private LocalDateTime verifiedAt;

    @NotNull
    @Column(name = "verification_status", nullable = false)
    private String verificationStatus;

    @Column(name = "verification_data", columnDefinition = "jsonb")
    private JsonNode verificationData;

    @Column(name = "trade_preferences", columnDefinition = "jsonb")
    private JsonNode tradePreferences;

    @Column(name = "compliance_data", columnDefinition = "jsonb")
    private JsonNode complianceData;

    @OneToMany(mappedBy = "organization", cascade = CascadeType.ALL, orphanRemoval = true)
    private Set<User> users = new HashSet<>();

    /**
     * Default constructor initializing required fields and empty collections.
     */
    public Organization() {
        super();
        this.verified = false;
        this.verificationStatus = "PENDING";
        this.verificationData = null;
        this.tradePreferences = null;
        this.complianceData = null;
        this.users = new HashSet<>();
        this.industry = "UNCLASSIFIED";
    }

    /**
     * Updates the organization's verification status with enhanced validation.
     *
     * @param status New verification status
     * @param data Additional verification data
     * @throws IllegalArgumentException if status or data is invalid
     */
    public void updateVerificationStatus(String status, JsonNode data) {
        if (status == null || !isValidVerificationStatus(status)) {
            throw new IllegalArgumentException("Invalid verification status");
        }

        this.verificationStatus = status;
        this.verificationData = data;

        if ("VERIFIED".equals(status)) {
            this.verified = true;
            this.verifiedAt = LocalDateTime.now();
        }
    }

    /**
     * Updates organization trade preferences with validation.
     *
     * @param preferences New trade preferences
     * @throws IllegalArgumentException if preferences are invalid
     */
    public void updateTradePreferences(JsonNode preferences) {
        if (preferences == null) {
            throw new IllegalArgumentException("Trade preferences cannot be null");
        }

        this.tradePreferences = preferences;
    }

    /**
     * Updates organization compliance information with validation.
     *
     * @param data New compliance data
     * @throws IllegalArgumentException if compliance data is invalid
     */
    public void updateComplianceData(JsonNode data) {
        if (data == null) {
            throw new IllegalArgumentException("Compliance data cannot be null");
        }

        this.complianceData = data;
    }

    /**
     * Validates if the given verification status is allowed.
     *
     * @param status Status to validate
     * @return true if status is valid, false otherwise
     */
    private boolean isValidVerificationStatus(String status) {
        return status.matches("^(PENDING|IN_PROGRESS|VERIFIED|REJECTED)$");
    }

    /**
     * Adds a user to the organization.
     *
     * @param user User to add
     */
    public void addUser(User user) {
        users.add(user);
        user.setOrganization(this);
    }

    /**
     * Removes a user from the organization.
     *
     * @param user User to remove
     */
    public void removeUser(User user) {
        users.remove(user);
        user.setOrganization(null);
    }
}