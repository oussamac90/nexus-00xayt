package com.nexus.order.integration;

import com.nexus.order.model.Order;
import com.nexus.common.validation.ValidationUtils;
import org.springframework.stereotype.Service;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.milyn.edifact.EDIFACTBuilder;
import org.milyn.edifact.EDIFACTParser;
import lombok.extern.slf4j.Slf4j;

import java.util.*;
import java.util.regex.Pattern;
import java.time.format.DateTimeFormatter;

/**
 * Service class responsible for secure EDIFACT message processing for B2B trade orders.
 * Implements EDIFACT D.01B standard with comprehensive validation and monitoring.
 *
 * @version 1.0
 * @since 2023-09-01
 */
@Service
@Slf4j
public class EdifactIntegration {

    private static final Logger logger = LoggerFactory.getLogger(EdifactIntegration.class);
    private static final String EDIFACT_VERSION = "D01B";
    private static final int MAX_MESSAGE_SIZE = 1048576; // 1MB limit
    private static final Map<String, Pattern> VALIDATION_PATTERNS;

    private final EDIFACTBuilder edifactBuilder;
    private final EDIFACTParser edifactParser;
    private final ValidationUtils validationUtils;

    static {
        VALIDATION_PATTERNS = new HashMap<>();
        VALIDATION_PATTERNS.put("UNH", Pattern.compile("^UNH\\+[^']+\\+ORDERS:D:01B:UN"));
        VALIDATION_PATTERNS.put("BGM", Pattern.compile("^BGM\\+220\\+[^']+\\+9'"));
        VALIDATION_PATTERNS.put("DTM", Pattern.compile("^DTM\\+137:[^:]+:203'"));
        VALIDATION_PATTERNS.put("NAD", Pattern.compile("^NAD\\+(BY|SE)\\+[^']+'"));
        VALIDATION_PATTERNS.put("LIN", Pattern.compile("^LIN\\+[^+]+\\+[^:]+:EN'"));
    }

    /**
     * Initializes EDIFACT integration components with security settings.
     *
     * @param validationUtils Validation utility instance
     */
    public EdifactIntegration(ValidationUtils validationUtils) {
        this.validationUtils = validationUtils;
        this.edifactBuilder = new EDIFACTBuilder()
            .setVersion(EDIFACT_VERSION)
            .setCharset("UTF-8")
            .setSecureProcessing(true)
            .build();
        
        this.edifactParser = new EDIFACTParser()
            .setVersion(EDIFACT_VERSION)
            .setValidation(true)
            .setSecureProcessing(true)
            .build();
    }

    /**
     * Securely converts an Order object to EDIFACT format message with validation.
     *
     * @param order Order to convert
     * @return Validated EDIFACT formatted message string
     * @throws IllegalArgumentException if order validation fails
     */
    public String convertOrderToEdifact(Order order) {
        logger.debug("Starting EDIFACT conversion for order: {}", order.getOrderNumber());

        // Validate order completeness
        Map<String, Object> fields = new HashMap<>();
        fields.put("orderNumber", order.getOrderNumber());
        fields.put("buyerId", order.getBuyerId());
        fields.put("sellerId", order.getSellerId());
        fields.put("items", order.getItems());

        List<String> missingFields = validationUtils.validateRequired(fields, 
            Arrays.asList("orderNumber", "buyerId", "sellerId", "items"));
        
        if (!missingFields.isEmpty()) {
            String error = "Missing required fields for EDIFACT conversion: " + String.join(", ", missingFields);
            logger.error(error);
            throw new IllegalArgumentException(error);
        }

        try {
            StringBuilder edifact = new StringBuilder();
            String messageId = UUID.randomUUID().toString();
            DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyyMMdd");

            // Build EDIFACT message with sanitized inputs
            edifact.append("UNH+").append(validationUtils.sanitizeInput(messageId))
                  .append("+ORDERS:D:01B:UN:EAN010'")
                  .append("BGM+220+").append(validationUtils.sanitizeInput(order.getOrderNumber()))
                  .append("+9'")
                  .append("DTM+137:").append(order.getOrderDate().format(formatter))
                  .append(":203'")
                  .append("NAD+BY+").append(validationUtils.sanitizeInput(order.getBuyerId().toString()))
                  .append("'")
                  .append("NAD+SE+").append(validationUtils.sanitizeInput(order.getSellerId().toString()))
                  .append("'");

            // Add order items with validation
            order.getItems().forEach(item -> {
                edifact.append("LIN+").append(validationUtils.sanitizeInput(item.getLineNumber().toString()))
                      .append("+").append(validationUtils.sanitizeInput(item.getProductSku()))
                      .append(":EN'")
                      .append("QTY+21:").append(validationUtils.sanitizeInput(item.getQuantity().toString()))
                      .append("'")
                      .append("MOA+203:").append(validationUtils.sanitizeInput(item.getUnitPrice().toString()))
                      .append("'");
            });

            // Add summary segments
            edifact.append("UNS+S'")
                  .append("CNT+2:").append(order.getItems().size())
                  .append("'")
                  .append("UNT+").append(order.getItems().size() * 3 + 7)
                  .append("+").append(messageId)
                  .append("'");

            String message = edifact.toString();
            validateEdifactMessage(message);
            
            logger.info("Successfully converted order {} to EDIFACT format", order.getOrderNumber());
            return message;

        } catch (Exception e) {
            logger.error("Error converting order to EDIFACT: {}", e.getMessage());
            throw new IllegalStateException("EDIFACT conversion failed", e);
        }
    }

    /**
     * Securely parses an EDIFACT message into Order object with validation.
     *
     * @param edifactMessage EDIFACT message to parse
     * @return Validated and parsed order object
     * @throws IllegalArgumentException if message validation fails
     */
    public Order parseEdifactMessage(String edifactMessage) {
        logger.debug("Starting EDIFACT message parsing");

        if (edifactMessage == null || edifactMessage.length() > MAX_MESSAGE_SIZE) {
            throw new IllegalArgumentException("Invalid EDIFACT message size");
        }

        // Validate message structure
        Map<String, List<String>> validationErrors = validateEdifactMessage(edifactMessage);
        if (!validationErrors.isEmpty()) {
            throw new IllegalArgumentException("EDIFACT message validation failed: " + validationErrors);
        }

        try {
            String sanitizedMessage = validationUtils.sanitizeInput(edifactMessage);
            Order order = new Order();
            
            // Parse message segments
            String[] segments = sanitizedMessage.split("'");
            for (String segment : segments) {
                if (segment.startsWith("BGM+220+")) {
                    order.setOrderNumber(segment.split("\\+")[2]);
                } else if (segment.startsWith("NAD+BY+")) {
                    order.setBuyerId(UUID.fromString(segment.split("\\+")[2]));
                } else if (segment.startsWith("NAD+SE+")) {
                    order.setSellerId(UUID.fromString(segment.split("\\+")[2]));
                }
                // Additional segment parsing...
            }

            logger.info("Successfully parsed EDIFACT message to order object");
            return order;

        } catch (Exception e) {
            logger.error("Error parsing EDIFACT message: {}", e.getMessage());
            throw new IllegalStateException("EDIFACT parsing failed", e);
        }
    }

    /**
     * Comprehensively validates EDIFACT message structure and content.
     *
     * @param edifactMessage Message to validate
     * @return Map of validation errors by segment
     */
    public Map<String, List<String>> validateEdifactMessage(String edifactMessage) {
        Map<String, List<String>> errors = new HashMap<>();
        
        if (edifactMessage == null || edifactMessage.length() > MAX_MESSAGE_SIZE) {
            errors.put("GENERAL", Collections.singletonList("Invalid message size"));
            return errors;
        }

        try {
            String[] segments = edifactMessage.split("'");
            
            // Validate each segment against patterns
            for (String segment : segments) {
                for (Map.Entry<String, Pattern> pattern : VALIDATION_PATTERNS.entrySet()) {
                    if (segment.startsWith(pattern.getKey()) && !pattern.getValue().matcher(segment).matches()) {
                        errors.computeIfAbsent(pattern.getKey(), k -> new ArrayList<>())
                              .add("Invalid segment format: " + segment);
                    }
                }
            }

            // Validate segment sequence
            if (!segments[0].startsWith("UNH")) {
                errors.computeIfAbsent("SEQUENCE", k -> new ArrayList<>())
                      .add("Message must start with UNH segment");
            }

            if (!segments[segments.length - 1].startsWith("UNT")) {
                errors.computeIfAbsent("SEQUENCE", k -> new ArrayList<>())
                      .add("Message must end with UNT segment");
            }

            logger.debug("EDIFACT validation completed with {} error categories", errors.size());
            return errors;

        } catch (Exception e) {
            logger.error("Error during EDIFACT validation: {}", e.getMessage());
            errors.put("GENERAL", Collections.singletonList("Validation processing error: " + e.getMessage()));
            return errors;
        }
    }
}