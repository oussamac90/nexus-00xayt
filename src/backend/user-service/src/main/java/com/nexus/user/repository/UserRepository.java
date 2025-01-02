package com.nexus.user.repository;

import com.nexus.user.model.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.QueryHints;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import jakarta.persistence.QueryHint;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Repository interface for User entity providing secure data access operations
 * with enhanced organization support and PII protection measures.
 *
 * @version 1.0
 * @since 2023-09-01
 */
@Repository
public interface UserRepository extends JpaRepository<User, UUID> {

    /**
     * Securely finds a user by email with PII protection measures.
     *
     * @param email The email address to search for
     * @return Optional containing the user if found
     */
    @Query("SELECT u FROM User u WHERE u.email = :email")
    @QueryHints(@QueryHint(name = "org.hibernate.readOnly", value = "true"))
    Optional<User> findByEmail(@Param("email") String email);

    /**
     * Retrieves users belonging to an organization with pagination support.
     *
     * @param organizationId The organization's UUID
     * @param pageable Pagination parameters
     * @return Page of users in the organization
     */
    @Query(value = "SELECT u FROM User u WHERE u.organization.id = :organizationId AND u.deleted = false",
           countQuery = "SELECT COUNT(u) FROM User u WHERE u.organization.id = :organizationId AND u.deleted = false")
    Page<User> findByOrganizationId(@Param("organizationId") UUID organizationId, Pageable pageable);

    /**
     * Finds an enabled user by email for authentication purposes.
     *
     * @param email The email address to search for
     * @param enabled The enabled status to match
     * @return Optional containing the enabled user if found
     */
    @Query("SELECT u FROM User u WHERE u.email = :email AND u.enabled = :enabled AND u.deleted = false")
    @QueryHints(@QueryHint(name = "org.hibernate.readOnly", value = "true"))
    Optional<User> findByEmailAndEnabled(@Param("email") String email, @Param("enabled") Boolean enabled);

    /**
     * Retrieves users with specific role in an organization with enhanced security.
     *
     * @param organizationId The organization's UUID
     * @param role The role to filter by
     * @param pageable Pagination parameters
     * @return Page of users with specified role
     */
    @Query(value = "SELECT u FROM User u WHERE u.organization.id = :organizationId AND u.role = :role AND u.deleted = false",
           countQuery = "SELECT COUNT(u) FROM User u WHERE u.organization.id = :organizationId AND u.role = :role AND u.deleted = false")
    Page<User> findByOrganizationIdAndRole(
            @Param("organizationId") UUID organizationId,
            @Param("role") String role,
            Pageable pageable);

    /**
     * Securely checks if a user exists with given email.
     *
     * @param email The email address to check
     * @return true if user exists, false otherwise
     */
    @Query("SELECT COUNT(u) > 0 FROM User u WHERE u.email = :email AND u.deleted = false")
    boolean existsByEmail(@Param("email") String email);

    /**
     * Finds users with verified email in an organization.
     *
     * @param organizationId The organization's UUID
     * @param pageable Pagination parameters
     * @return Page of verified users
     */
    @Query(value = "SELECT u FROM User u WHERE u.organization.id = :organizationId AND u.emailVerified = true AND u.deleted = false",
           countQuery = "SELECT COUNT(u) FROM User u WHERE u.organization.id = :organizationId AND u.emailVerified = true AND u.deleted = false")
    Page<User> findVerifiedUsersByOrganization(@Param("organizationId") UUID organizationId, Pageable pageable);

    /**
     * Retrieves users with failed login attempts exceeding threshold.
     *
     * @param organizationId The organization's UUID
     * @param failedAttempts The threshold of failed attempts
     * @return List of users with excessive failed login attempts
     */
    @Query("SELECT u FROM User u WHERE u.organization.id = :organizationId AND u.failedLoginAttempts >= :failedAttempts AND u.deleted = false")
    List<User> findUsersWithFailedLogins(
            @Param("organizationId") UUID organizationId,
            @Param("failedAttempts") Integer failedAttempts);

    /**
     * Finds users requiring email verification reminder.
     *
     * @param organizationId The organization's UUID
     * @param pageable Pagination parameters
     * @return Page of unverified users
     */
    @Query(value = "SELECT u FROM User u WHERE u.organization.id = :organizationId AND u.emailVerified = false AND u.deleted = false",
           countQuery = "SELECT COUNT(u) FROM User u WHERE u.organization.id = :organizationId AND u.emailVerified = false AND u.deleted = false")
    Page<User> findUnverifiedUsers(@Param("organizationId") UUID organizationId, Pageable pageable);
}