package com.nexus.common.model;

import jakarta.persistence.Column;
import jakarta.persistence.EntityListeners;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.MappedSuperclass;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Version;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Abstract base class providing common functionality for all domain entities in the Nexus platform.
 * Implements automated audit trails, optimistic locking, and soft deletion support.
 * 
 * @version 1.0
 * @since 2023-09-01
 */
@MappedSuperclass
@EntityListeners(AuditingEntityListener.class)
@Getter
@Setter
public abstract class BaseEntity {

    /**
     * Unique identifier for the entity using UUID to ensure global uniqueness.
     */
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", updatable = false, nullable = false, columnDefinition = "UUID")
    private UUID id;

    /**
     * Version field for optimistic locking support.
     */
    @Version
    @Column(name = "version", nullable = false)
    private Long version;

    /**
     * Timestamp when the entity was created.
     */
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    /**
     * Identifier of the user who created the entity.
     */
    @Column(name = "created_by", length = 50, nullable = false, updatable = false)
    private String createdBy;

    /**
     * Timestamp when the entity was last updated.
     */
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    /**
     * Identifier of the user who last updated the entity.
     */
    @Column(name = "updated_by", length = 50, nullable = false)
    private String updatedBy;

    /**
     * Soft deletion flag. When true, the record is considered deleted.
     */
    @Column(name = "deleted", nullable = false)
    private Boolean deleted;

    /**
     * Default constructor initializing entity with UUID and default values.
     */
    protected BaseEntity() {
        this.id = UUID.randomUUID();
        this.version = 0L;
        this.deleted = false;
    }

    /**
     * JPA lifecycle callback executed before entity persistence.
     * Ensures all required audit fields are properly initialized.
     */
    @PrePersist
    protected void prePersist() {
        if (this.id == null) {
            this.id = UUID.randomUUID();
        }
        
        LocalDateTime now = LocalDateTime.now();
        if (this.createdAt == null) {
            this.createdAt = now;
            this.updatedAt = now;
        }
        
        if (this.deleted == null) {
            this.deleted = false;
        }
    }

    /**
     * JPA lifecycle callback executed before entity update.
     * Updates the audit trail information while preserving creation data.
     */
    @PreUpdate
    protected void preUpdate() {
        this.updatedAt = LocalDateTime.now();
    }

    /**
     * Marks the entity as deleted using soft deletion.
     */
    public void markAsDeleted() {
        this.deleted = true;
    }

    /**
     * Checks if the entity has been marked as deleted.
     * 
     * @return true if the entity is marked as deleted, false otherwise
     */
    public boolean isDeleted() {
        return Boolean.TRUE.equals(this.deleted);
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof BaseEntity)) return false;
        BaseEntity that = (BaseEntity) o;
        return id != null && id.equals(that.getId());
    }

    @Override
    public int hashCode() {
        return getClass().hashCode();
    }
}