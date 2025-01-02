package com.nexus.shipping;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.nexus.shipping.model.Shipment;
import com.nexus.shipping.repository.ShipmentRepository;
import com.nexus.shipping.service.ShippingService;
import com.nexus.shipping.service.integration.CarrierIntegrationService;
import com.nexus.shipping.service.document.DocumentGenerationService;
import com.nexus.shipping.exception.ShippingException;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.cloud.client.circuitbreaker.CircuitBreaker;
import org.springframework.cloud.client.circuitbreaker.CircuitBreakerFactory;
import org.springframework.util.StopWatch;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.CompletableFuture;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Comprehensive test suite for the Shipping Service microservice.
 * Validates shipping operations, carrier integrations, and performance requirements.
 */
@SpringBootTest
@ExtendWith(MockitoExtension.class)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
public class ShippingServiceTests {

    private static final long PERFORMANCE_THRESHOLD_MS = 500L;
    private static final String MOCK_TRACKING_NUMBER = "MOCK123456789";
    private static final UUID MOCK_ORDER_ID = UUID.randomUUID();

    @Mock
    private ShipmentRepository shipmentRepository;

    @Mock
    private CarrierIntegrationService carrierService;

    @Mock
    private DocumentGenerationService documentService;

    @Mock
    private CircuitBreakerFactory circuitBreakerFactory;

    @Mock
    private CircuitBreaker circuitBreaker;

    private ShippingService shippingService;
    private ObjectMapper objectMapper;
    private StopWatch stopWatch;

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        stopWatch = new StopWatch();

        when(circuitBreakerFactory.create(anyString())).thenReturn(circuitBreaker);
        when(circuitBreaker.run(any(), any())).thenAnswer(invocation -> {
            Runnable runnable = invocation.getArgument(0);
            return runnable.run();
        });

        shippingService = new ShippingService(
            shipmentRepository,
            carrierService,
            documentService,
            circuitBreakerFactory
        );
    }

    @Test
    void testCreateShipmentPerformance() {
        // Prepare test data
        ObjectNode shippingDetails = objectMapper.createObjectNode()
            .put("carrier", "DHL")
            .put("serviceLevel", "EXPRESS")
            .put("weight", "10.5")
            .put("weightUnit", "KG");
        
        when(carrierService.generateTrackingNumber(any())).thenReturn(MOCK_TRACKING_NUMBER);
        when(shipmentRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        // Execute with performance measurement
        stopWatch.start();
        Shipment result = shippingService.createShipment(MOCK_ORDER_ID, shippingDetails);
        stopWatch.stop();

        // Verify performance
        assertTrue(stopWatch.getTotalTimeMillis() < PERFORMANCE_THRESHOLD_MS,
            "Shipment creation exceeded performance threshold");

        // Verify shipment details
        assertNotNull(result);
        assertEquals(MOCK_TRACKING_NUMBER, result.getTrackingNumber());
        assertEquals("DHL", result.getCarrier());
        assertEquals("EXPRESS", result.getServiceLevel());

        // Verify interactions
        verify(carrierService).generateTrackingNumber(any());
        verify(shipmentRepository).save(any());
    }

    @Test
    void testInternationalShipmentWithCustoms() {
        // Prepare test data
        Shipment mockShipment = new Shipment();
        mockShipment.setTrackingNumber(MOCK_TRACKING_NUMBER);
        mockShipment.setCarrier("DHL");
        mockShipment.setServiceLevel("INTERNATIONAL");

        Map<String, String> customsDocuments = new HashMap<>();
        customsDocuments.put("COMMERCIAL_INVOICE", "url1");
        customsDocuments.put("CUSTOMS_DECLARATION", "url2");

        when(shipmentRepository.findByTrackingNumber(MOCK_TRACKING_NUMBER))
            .thenReturn(Optional.of(mockShipment));
        when(documentService.generateCustomsDocuments(any()))
            .thenReturn(customsDocuments);

        // Execute
        CompletableFuture<Map<String, String>> future = 
            shippingService.generateCustomsDocuments(MOCK_TRACKING_NUMBER);
        Map<String, String> result = future.join();

        // Verify
        assertNotNull(result);
        assertEquals(2, result.size());
        assertTrue(result.containsKey("COMMERCIAL_INVOICE"));
        assertTrue(result.containsKey("CUSTOMS_DECLARATION"));

        verify(documentService).generateCustomsDocuments(mockShipment);
        verify(shipmentRepository).save(any());
    }

    @Test
    void testUpdateTrackingStatus() {
        // Prepare test data
        Shipment mockShipment = new Shipment();
        mockShipment.setTrackingNumber(MOCK_TRACKING_NUMBER);
        
        when(shipmentRepository.findByTrackingNumber(MOCK_TRACKING_NUMBER))
            .thenReturn(Optional.of(mockShipment));

        ObjectNode carrierDetails = objectMapper.createObjectNode()
            .put("location_code", "FRA1")
            .put("scan_type", "ARRIVAL");

        // Execute
        shippingService.updateTrackingStatus(
            MOCK_TRACKING_NUMBER,
            "IN_TRANSIT",
            "Frankfurt Airport",
            carrierDetails
        );

        // Verify
        ArgumentCaptor<Shipment> shipmentCaptor = ArgumentCaptor.forClass(Shipment.class);
        verify(shipmentRepository).save(shipmentCaptor.capture());
        
        Shipment updatedShipment = shipmentCaptor.getValue();
        assertEquals("IN_TRANSIT", updatedShipment.getStatus());
        assertNotNull(updatedShipment.getTrackingHistory());
    }

    @Test
    void testCarrierIntegrationFailure() {
        when(carrierService.generateTrackingNumber(any()))
            .thenThrow(new RuntimeException("Carrier API unavailable"));

        ObjectNode shippingDetails = objectMapper.createObjectNode()
            .put("carrier", "DHL")
            .put("serviceLevel", "EXPRESS");

        assertThrows(ShippingException.class, () -> 
            shippingService.createShipment(MOCK_ORDER_ID, shippingDetails));

        verify(carrierService).generateTrackingNumber(any());
        verify(shipmentRepository, never()).save(any());
    }

    @Test
    void testGetShipmentsByOrder() {
        List<Shipment> mockShipments = Arrays.asList(
            new Shipment(),
            new Shipment()
        );

        when(shipmentRepository.findByOrderId(MOCK_ORDER_ID))
            .thenReturn(mockShipments);

        List<Shipment> result = shippingService.getShipmentsByOrder(MOCK_ORDER_ID);

        assertNotNull(result);
        assertEquals(2, result.size());
        verify(shipmentRepository).findByOrderId(MOCK_ORDER_ID);
    }

    @Test
    void testGenerateShippingLabel() {
        Shipment mockShipment = new Shipment();
        mockShipment.setTrackingNumber(MOCK_TRACKING_NUMBER);
        String mockLabelUrl = "https://carrier.com/labels/123.pdf";

        when(shipmentRepository.findByTrackingNumber(MOCK_TRACKING_NUMBER))
            .thenReturn(Optional.of(mockShipment));
        when(carrierService.generateLabel(any()))
            .thenReturn(mockLabelUrl);

        String result = shippingService.generateShippingLabel(MOCK_TRACKING_NUMBER);

        assertNotNull(result);
        assertEquals(mockLabelUrl, result);
        verify(carrierService).generateLabel(mockShipment);
    }
}