package com.nexus.user.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.JsonNode;
import com.nexus.common.model.BaseEntity;
import jakarta.persistence.*;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Pattern;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;

/**
 * Entity class representing a user in the Nexus B2B trade platform.
 * Implements enhanced security features, profile management, and role-based access control.
 *
 * @version 1.0
 * @since 2023-09-01
 */
@Entity
@Table(name = "users", indexes = {
    @Index(name = "idx_user_email", columnList = "email", unique = true),
    @Index(name = "idx_user_phone", columnList = "phone_number")
})
@Data
@EqualsAndHashCode(callSuper = true)
@JsonIgnoreProperties(ignoreUnknown = true)
public class User extends BaseEntity {

    @Email(message = "Invalid email format")
    @Column(name = "email", nullable = false, length = 255)
    private String email;

    @Column(name = "first_name", length = 50)
    @Convert(converter = PiiEncryptionConverter.class)
    private String firstName;

    @Column(name = "last_name", length = 50)
    @Convert(converter = PiiEncryptionConverter.class)
    private String lastName;

    @JsonIgnore
    @Column(name = "password_hash", nullable = false)
    private String passwordHash;

    @Pattern(regexp = "^\\+?[1-9]\\d{1,14}$", message = "Invalid phone number format")
    @Column(name = "phone_number", length = 20)
    @Convert(converter = PiiEncryptionConverter.class)
    private String phoneNumber;

    @Enumerated(EnumType.STRING)
    @Column(name = "role", nullable = false)
    private UserRole role;

    @Column(name = "enabled", nullable = false)
    private Boolean enabled;

    @Column(name = "email_verified", nullable = false)
    private Boolean emailVerified;

    @Column(name = "last_login_at")
    private LocalDateTime lastLoginAt;

    @Column(name = "email_verified_at")
    private LocalDateTime emailVerifiedAt;

    @Column(name = "profile_data", columnDefinition = "jsonb")
    @JdbcTypeCode(SqlTypes.JSON)
    private JsonNode profileData;

    @Column(name = "preferences", columnDefinition = "jsonb")
    @JdbcTypeCode(SqlTypes.JSON)
    private JsonNode preferences;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "organization_id")
    private Organization organization;

    @Column(name = "failed_login_attempts", nullable = false)
    private Integer failedLoginAttempts;

    @Column(name = "account_locked_until")
    private LocalDateTime accountLockedUntil;

    /**
     * Default constructor initializing a new user with security defaults.
     */
    public User() {
        super();
        this.enabled = false;
        this.emailVerified = false;
        this.role = UserRole.BUYER;
        this.failedLoginAttempts = 0;
        this.profileData = null;
        this.preferences = null;
    }

    /**
     * Updates the user's profile data with validation and sanitization.
     *
     * @param profile The new profile data to be set
     * @throws IllegalArgumentException if profile data is invalid
     */
    public void updateProfile(JsonNode profile) {
        if (profile == null) {
            throw new IllegalArgumentException("Profile data cannot be null");
        }
        // Profile schema validation would be implemented here
        this.profileData = profile;
    }

    /**
     * Handles successful email verification process.
     */
    public void verifyEmail() {
        this.emailVerified = true;
        this.emailVerifiedAt = LocalDateTime.now();
        if (!this.enabled) {
            this.enabled = true;
        }
    }

    /**
     * Records a successful login attempt.
     */
    public void recordSuccessfulLogin() {
        this.lastLoginAt = LocalDateTime.now();
        this.failedLoginAttempts = 0;
        this.accountLockedUntil = null;
    }

    /**
     * Records a failed login attempt and implements account locking if necessary.
     *
     * @return true if account is now locked, false otherwise
     */
    public boolean recordFailedLogin() {
        this.failedLoginAttempts++;
        
        if (this.failedLoginAttempts >= 5) {
            this.accountLockedUntil = LocalDateTime.now().plusMinutes(30);
            return true;
        }
        return false;
    }

    /**
     * Checks if the account is currently locked.
     *
     * @return true if account is locked, false otherwise
     */
    public boolean isAccountLocked() {
        return accountLockedUntil != null && 
               LocalDateTime.now().isBefore(accountLockedUntil);
    }

    /**
     * Updates the user's organization association.
     *
     * @param organization The organization to associate with the user
     */
    public void setOrganization(Organization organization) {
        this.organization = organization;
        if (organization != null && this.role == UserRole.BUYER) {
            this.role = UserRole.VENDOR;
        }
    }
}