package com.nexus.auth;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.nexus.auth.security.JwtTokenProvider;
import com.nexus.auth.service.AuthService;
import com.nexus.common.security.SecurityUtils;
import com.nexus.user.model.User;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.cache.Cache;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.LockedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.totp.TOTPService;
import org.springframework.security.web.util.rate.RateLimiter;
import org.springframework.test.context.TestPropertySource;

import java.time.LocalDateTime;
import java.util.Base64;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@SpringBootTest
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@TestPropertySource(properties = {
    "spring.security.oauth2.jwt.secret=" + AuthServiceTests.MOCK_JWT_SECRET,
    "nexus.security.mfa.rate-limit=3/hour"
})
public class AuthServiceTests {

    // Test constants
    static final String TEST_USER_EMAIL = "test@example.com";
    static final String TEST_USER_PASSWORD = "password123";
    static final String TEST_MFA_SECRET = "JBSWY3DPEHPK3PXP";
    static final String[] TEST_BACKUP_CODES = {"12345678", "87654321"};
    static final String MOCK_JWT_SECRET = "test-jwt-secret-key-for-unit-tests";

    @Mock private AuthenticationManager authenticationManager;
    @Mock private JwtTokenProvider jwtTokenProvider;
    @Mock private UserDetailsService userDetailsService;
    @Mock private PasswordEncoder passwordEncoder;
    @Mock private TOTPService totpService;
    @Mock private RateLimiter rateLimiter;
    @Mock private Cache tokenCache;
    
    private AuthService authService;
    private User testUser;
    private ObjectMapper objectMapper;

    @BeforeAll
    void init() {
        objectMapper = new ObjectMapper();
    }

    @BeforeEach
    void setUp() {
        // Initialize test user
        testUser = new User();
        testUser.setEmail(TEST_USER_EMAIL);
        testUser.setEnabled(true);
        testUser.setEmailVerified(true);
        testUser.setFailedLoginAttempts(0);
        
        // Setup MFA profile data
        JsonNode mfaData = objectMapper.createObjectNode()
            .put("mfaEnabled", true)
            .put("mfaSecret", SecurityUtils.encrypt(TEST_MFA_SECRET, MOCK_JWT_SECRET));
        testUser.updateProfile(mfaData);

        // Initialize auth service
        authService = new AuthService(
            authenticationManager,
            jwtTokenProvider,
            userDetailsService,
            passwordEncoder,
            totpService,
            rateLimiter,
            tokenCache
        );

        // Reset security context
        SecurityContextHolder.clearContext();
    }

    @Test
    void testSuccessfulAuthentication() {
        // Arrange
        Authentication mockAuth = new UsernamePasswordAuthenticationToken(TEST_USER_EMAIL, TEST_USER_PASSWORD);
        when(authenticationManager.authenticate(any())).thenReturn(mockAuth);
        when(userDetailsService.loadUserByUsername(TEST_USER_EMAIL)).thenReturn(testUser);
        when(jwtTokenProvider.generateToken(any())).thenReturn("mock.access.token");
        when(jwtTokenProvider.generateRefreshToken(TEST_USER_EMAIL)).thenReturn("mock.refresh.token");
        when(rateLimiter.tryConsume(TEST_USER_EMAIL)).thenReturn(true);

        // Act
        var response = authService.authenticate(TEST_USER_EMAIL, TEST_USER_PASSWORD);

        // Assert
        assertNotNull(response);
        assertEquals("Bearer", response.getTokenType());
        assertTrue(response.isRequiresMfa());
        verify(tokenCache).put(eq("mock.access.token"), any());
        verify(rateLimiter).tryConsume(TEST_USER_EMAIL);
    }

    @Test
    void testFailedAuthentication() {
        // Arrange
        when(authenticationManager.authenticate(any()))
            .thenThrow(new BadCredentialsException("Invalid credentials"));
        when(userDetailsService.loadUserByUsername(TEST_USER_EMAIL)).thenReturn(testUser);
        when(rateLimiter.tryConsume(TEST_USER_EMAIL)).thenReturn(true);

        // Act & Assert
        assertThrows(BadCredentialsException.class, () -> 
            authService.authenticate(TEST_USER_EMAIL, TEST_USER_PASSWORD)
        );
        assertEquals(1, testUser.getFailedLoginAttempts());
    }

    @Test
    void testAccountLockout() {
        // Arrange
        testUser.setFailedLoginAttempts(4);
        when(authenticationManager.authenticate(any()))
            .thenThrow(new BadCredentialsException("Invalid credentials"));
        when(userDetailsService.loadUserByUsername(TEST_USER_EMAIL)).thenReturn(testUser);
        when(rateLimiter.tryConsume(TEST_USER_EMAIL)).thenReturn(true);

        // Act & Assert
        assertThrows(LockedException.class, () -> 
            authService.authenticate(TEST_USER_EMAIL, TEST_USER_PASSWORD)
        );
        assertTrue(testUser.isAccountLocked());
        assertNotNull(testUser.getAccountLockedUntil());
    }

    @Test
    void testSuccessfulMFASetup() {
        // Arrange
        when(userDetailsService.loadUserByUsername(TEST_USER_EMAIL)).thenReturn(testUser);
        when(totpService.generateQrCodeData(eq("Nexus B2B"), eq(TEST_USER_EMAIL), any()))
            .thenReturn("otpauth://totp/Nexus%20B2B:test@example.com?secret=JBSWY3DPEHPK3PXP");

        // Act
        var response = authService.setupMFA(TEST_USER_EMAIL);

        // Assert
        assertNotNull(response);
        assertNotNull(response.getQrCodeData());
        assertNotNull(response.getBackupCodes());
        assertEquals(8, response.getBackupCodes().length);
    }

    @Test
    void testSuccessfulMFAVerification() {
        // Arrange
        String validCode = "123456";
        when(userDetailsService.loadUserByUsername(TEST_USER_EMAIL)).thenReturn(testUser);
        when(totpService.validateCode(TEST_MFA_SECRET, validCode)).thenReturn(true);
        SecurityContextHolder.getContext().setAuthentication(
            new UsernamePasswordAuthenticationToken(TEST_USER_EMAIL, null)
        );

        // Act
        boolean result = authService.verifyMFACode(validCode);

        // Assert
        assertTrue(result);
    }

    @Test
    void testTokenRefresh() {
        // Arrange
        String refreshToken = "valid.refresh.token";
        String newAccessToken = "new.access.token";
        when(jwtTokenProvider.validateToken(refreshToken)).thenReturn(true);
        when(jwtTokenProvider.refreshAccessToken(refreshToken)).thenReturn(newAccessToken);
        SecurityContextHolder.getContext().setAuthentication(
            new UsernamePasswordAuthenticationToken(TEST_USER_EMAIL, null)
        );

        // Act
        var response = authService.refreshToken(refreshToken);

        // Assert
        assertNotNull(response);
        assertEquals(newAccessToken, response.getAccessToken());
        assertEquals("Bearer", response.getTokenType());
        verify(tokenCache).put(eq(newAccessToken), any());
    }

    @Test
    void testRateLimitExceeded() {
        // Arrange
        when(rateLimiter.tryConsume(TEST_USER_EMAIL)).thenReturn(false);

        // Act & Assert
        assertThrows(RuntimeException.class, () ->
            authService.authenticate(TEST_USER_EMAIL, TEST_USER_PASSWORD)
        );
        verify(authenticationManager, never()).authenticate(any());
    }

    @Test
    void testSecurityValidation() {
        // Arrange
        Authentication mockAuth = new UsernamePasswordAuthenticationToken(TEST_USER_EMAIL, TEST_USER_PASSWORD);
        when(authenticationManager.authenticate(any())).thenReturn(mockAuth);
        when(userDetailsService.loadUserByUsername(TEST_USER_EMAIL)).thenReturn(testUser);
        when(jwtTokenProvider.generateToken(any())).thenReturn("mock.access.token");
        when(rateLimiter.tryConsume(TEST_USER_EMAIL)).thenReturn(true);

        // Act
        var response = authService.authenticate(TEST_USER_EMAIL, TEST_USER_PASSWORD);

        // Assert
        assertNotNull(response);
        verify(tokenCache).put(argThat(token -> 
            token.equals("mock.access.token")), 
            argThat(metadata -> 
                metadata instanceof Map && 
                ((Map) metadata).containsKey("createdAt") &&
                ((Map) metadata).containsKey("tokenId")
            )
        );
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }
}