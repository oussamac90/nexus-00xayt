package com.nexus.common.exception;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.validation.BindingResult;
import org.springframework.validation.ObjectError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.context.request.ServletWebRequest;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Global exception handler for centralized error handling across all microservices.
 * Implements standardized error responses with security awareness and distributed tracing.
 * 
 * @version 1.0
 * @since 2023-09-01
 */
@ControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger logger = LoggerFactory.getLogger(GlobalExceptionHandler.class);
    private static final String X_CORRELATION_ID = "X-Correlation-ID";
    
    private final ObjectMapper objectMapper;
    private final ErrorResponseBuilder errorResponseBuilder;

    /**
     * Initializes the exception handler with required dependencies.
     *
     * @param objectMapper JSON object mapper for response serialization
     * @param errorResponseBuilder Builder for creating standardized error responses
     */
    public GlobalExceptionHandler(ObjectMapper objectMapper, ErrorResponseBuilder errorResponseBuilder) {
        this.objectMapper = objectMapper;
        this.errorResponseBuilder = errorResponseBuilder;
    }

    /**
     * Handles validation exceptions with detailed field-level error information.
     *
     * @param ex The validation exception
     * @param request The web request context
     * @return Structured error response with validation details
     */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleValidationException(
            MethodArgumentNotValidException ex,
            ServletWebRequest request) {
        
        String correlationId = extractCorrelationId(request);
        try {
            MDC.put("correlationId", correlationId);
            MDC.put("path", request.getRequest().getRequestURI());

            logger.error("Validation error occurred: {}", ex.getMessage());

            List<String> errors = ex.getBindingResult()
                .getAllErrors()
                .stream()
                .map(this::formatValidationError)
                .collect(Collectors.toList());

            ErrorResponse errorResponse = errorResponseBuilder
                .withCorrelationId(correlationId)
                .withError("validation")
                .withMessage("Validation failed")
                .withDetails(errors)
                .build();

            return ResponseEntity
                .status(HttpStatus.BAD_REQUEST)
                .body(errorResponse);
        } finally {
            MDC.clear();
        }
    }

    /**
     * Handles authentication exceptions with security-aware logging.
     *
     * @param ex The authentication exception
     * @param request The web request context
     * @return Sanitized error response for authentication failures
     */
    @ExceptionHandler(AuthenticationException.class)
    public ResponseEntity<ErrorResponse> handleAuthenticationException(
            AuthenticationException ex,
            ServletWebRequest request) {
        
        String correlationId = extractCorrelationId(request);
        try {
            MDC.put("correlationId", correlationId);
            MDC.put("securityContext", "authentication");
            
            logger.error("Authentication failed: {}", ex.getMessage());
            
            ErrorResponse errorResponse = errorResponseBuilder
                .withCorrelationId(correlationId)
                .withError("auth")
                .withMessage("Authentication failed")
                .build();

            logSecurityEvent("AUTHENTICATION_FAILED", request);

            return ResponseEntity
                .status(HttpStatus.UNAUTHORIZED)
                .body(errorResponse);
        } finally {
            MDC.clear();
        }
    }

    /**
     * Handles authorization exceptions with audit logging.
     *
     * @param ex The access denied exception
     * @param request The web request context
     * @return Sanitized error response for authorization failures
     */
    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ErrorResponse> handleAccessDeniedException(
            AccessDeniedException ex,
            ServletWebRequest request) {
        
        String correlationId = extractCorrelationId(request);
        try {
            MDC.put("correlationId", correlationId);
            MDC.put("securityContext", "authorization");
            
            logger.error("Access denied: {}", ex.getMessage());
            
            ErrorResponse errorResponse = errorResponseBuilder
                .withCorrelationId(correlationId)
                .withError("forbidden")
                .withMessage("Access denied")
                .build();

            logSecurityEvent("ACCESS_DENIED", request);

            return ResponseEntity
                .status(HttpStatus.FORBIDDEN)
                .body(errorResponse);
        } finally {
            MDC.clear();
        }
    }

    /**
     * Handles unexpected exceptions with system health impact assessment.
     *
     * @param ex The unexpected exception
     * @param request The web request context
     * @return Generic error response with system health status
     */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleGeneralException(
            Exception ex,
            ServletWebRequest request) {
        
        String correlationId = extractCorrelationId(request);
        try {
            MDC.put("correlationId", correlationId);
            MDC.put("severity", "ERROR");
            
            logger.error("Unexpected error occurred: ", ex);
            
            ErrorResponse errorResponse = errorResponseBuilder
                .withCorrelationId(correlationId)
                .withError("internal")
                .withMessage("An unexpected error occurred")
                .build();

            assessSystemHealth(ex);

            return ResponseEntity
                .status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(errorResponse);
        } finally {
            MDC.clear();
        }
    }

    /**
     * Extracts or generates correlation ID from request context.
     */
    private String extractCorrelationId(ServletWebRequest request) {
        String correlationId = request.getHeader(X_CORRELATION_ID);
        return correlationId != null ? correlationId : UUID.randomUUID().toString();
    }

    /**
     * Formats validation error messages for client consumption.
     */
    private String formatValidationError(ObjectError error) {
        return String.format("%s: %s",
            error.getObjectName(),
            error.getDefaultMessage());
    }

    /**
     * Logs security events for audit purposes.
     */
    private void logSecurityEvent(String eventType, ServletWebRequest request) {
        logger.info("Security event: {} - IP: {} - URI: {}",
            eventType,
            request.getRequest().getRemoteAddr(),
            request.getRequest().getRequestURI());
    }

    /**
     * Assesses system health impact of unexpected exceptions.
     */
    private void assessSystemHealth(Exception ex) {
        // Implementation would include metrics collection and health check updates
        logger.warn("System health check triggered by exception: {}", ex.getClass().getSimpleName());
    }
}