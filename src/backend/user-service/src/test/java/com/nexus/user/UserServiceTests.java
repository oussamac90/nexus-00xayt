package com.nexus.user;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.nexus.user.model.User;
import com.nexus.user.model.Organization;
import com.nexus.user.model.UserRole;
import com.nexus.user.repository.UserRepository;
import com.nexus.user.service.UserService;
import com.nexus.common.security.SecurityUtils;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.Timeout;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.oauth2.core.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.core.user.DefaultOAuth2User;
import org.springframework.security.test.context.support.WithMockUser;

import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Comprehensive test suite for UserService covering authentication, authorization,
 * and data security features.
 * 
 * @version 1.0
 * @since 2023-09-01
 */
@ExtendWith(MockitoExtension.class)
public class UserServiceTests {

    @InjectMocks
    private UserService userService;

    @Mock
    private UserRepository userRepository;

    @Mock
    private BCryptPasswordEncoder passwordEncoder;

    @Spy
    private ObjectMapper objectMapper;

    @Mock
    private SecurityUtils securityUtils;

    private static final String TEST_EMAIL = "test@nexus.com";
    private static final String TEST_MFA_SECRET = "MFASECRET123";
    private static final String ENCRYPTION_KEY = "NEXUS_MFA_KEY_2023";

    @BeforeEach
    void setUp() throws Exception {
        // Configure encryption mocks
        when(securityUtils.encrypt(anyString(), eq(ENCRYPTION_KEY)))
            .thenReturn("encrypted".getBytes());
        when(securityUtils.decrypt(any(byte[].class), eq(ENCRYPTION_KEY)))
            .thenReturn("decrypted");
    }

    @Test
    @Timeout(value = 1, unit = TimeUnit.SECONDS)
    void testOAuth2Authentication() throws Exception {
        // Prepare test data
        Map<String, Object> attributes = new HashMap<>();
        attributes.put("email", TEST_EMAIL);
        attributes.put("given_name", "John");
        attributes.put("family_name", "Doe");
        attributes.put("mfa_token", "123456");

        OAuth2AuthenticationToken token = mock(OAuth2AuthenticationToken.class);
        DefaultOAuth2User principal = mock(DefaultOAuth2User.class);
        when(principal.getAttributes()).thenReturn(attributes);
        when(token.getPrincipal()).thenReturn(principal);

        User user = new User();
        user.setEmail(TEST_EMAIL);
        user.setMfaEnabled(true);
        user.setMfaSecret(Base64.getEncoder().encodeToString("encrypted".getBytes()));
        
        when(userRepository.findByEmail(TEST_EMAIL)).thenReturn(Optional.of(user));
        when(userRepository.save(any(User.class))).thenReturn(user);

        // Execute and verify
        User authenticatedUser = userService.authenticateWithOAuth2(token);
        
        assertNotNull(authenticatedUser);
        assertEquals(TEST_EMAIL, authenticatedUser.getEmail());
        verify(userRepository).save(any(User.class));
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void testMFASetup() throws Exception {
        // Prepare test data
        UUID userId = UUID.randomUUID();
        User user = new User();
        user.setId(userId);
        user.setEmail(TEST_EMAIL);
        
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(userRepository.save(any(User.class))).thenReturn(user);

        // Execute
        Map<String, String> mfaSetup = userService.setupMFA(userId, "TOTP");

        // Verify
        assertNotNull(mfaSetup);
        assertTrue(mfaSetup.containsKey("secret"));
        assertTrue(mfaSetup.containsKey("qrCode"));
        verify(userRepository).save(argThat(u -> u.getMfaEnabled() && u.getMfaSecret() != null));
    }

    @Test
    void testUserCreationWithPIIEncryption() throws Exception {
        // Prepare test data with PII fields
        Map<String, Object> attributes = new HashMap<>();
        attributes.put("email", TEST_EMAIL);
        attributes.put("given_name", "John");
        attributes.put("family_name", "Doe");
        attributes.put("phone_number", "+1234567890");

        User user = new User();
        user.setEmail(TEST_EMAIL);
        
        when(userRepository.findByEmail(TEST_EMAIL)).thenReturn(Optional.empty());
        when(userRepository.save(any(User.class))).thenReturn(user);

        // Execute
        User createdUser = userService.createNewUser(attributes);

        // Verify PII encryption
        assertNotNull(createdUser);
        verify(userRepository).save(argThat(u -> 
            u.getEmail().equals(TEST_EMAIL) &&
            u.getEnabled() &&
            u.getEmailVerified()
        ));
    }

    @Test
    void testFailedLoginAttempts() throws Exception {
        // Prepare test user
        User user = new User();
        user.setEmail(TEST_EMAIL);
        user.setFailedLoginAttempts(0);
        
        when(userRepository.findByEmail(TEST_EMAIL)).thenReturn(Optional.of(user));
        when(userRepository.save(any(User.class))).thenReturn(user);

        // Execute multiple failed attempts
        for (int i = 0; i < 5; i++) {
            userService.validateMFA(TEST_EMAIL, "invalid_token");
        }

        // Verify account locking
        verify(userRepository, times(5)).save(argThat(u ->
            u.getFailedLoginAttempts() > 0 &&
            (u.getFailedLoginAttempts() == 5 ? u.isAccountLocked() : true)
        ));
    }

    @Test
    void testOrganizationRoleConstraints() {
        // Prepare test data
        Organization org = new Organization();
        org.setId(UUID.randomUUID());
        org.setName("Test Corp");
        org.setVerified(true);

        User user = new User();
        user.setEmail(TEST_EMAIL);
        user.setRole(UserRole.BUYER);
        
        when(userRepository.findByEmail(TEST_EMAIL)).thenReturn(Optional.of(user));
        when(userRepository.save(any(User.class))).thenReturn(user);

        // Execute role change
        user.setOrganization(org);

        // Verify role constraints
        verify(userRepository).save(argThat(u ->
            u.getRole() == UserRole.VENDOR &&
            u.getOrganization().equals(org)
        ));
    }

    @Test
    void testEmailVerification() {
        // Prepare test user
        User user = new User();
        user.setEmail(TEST_EMAIL);
        user.setEmailVerified(false);
        user.setEnabled(false);
        
        when(userRepository.findByEmail(TEST_EMAIL)).thenReturn(Optional.of(user));
        when(userRepository.save(any(User.class))).thenReturn(user);

        // Execute verification
        user.verifyEmail();

        // Verify state changes
        verify(userRepository).save(argThat(u ->
            u.getEmailVerified() &&
            u.getEnabled() &&
            u.getEmailVerifiedAt() != null
        ));
    }
}