package com.nexus.order;

import com.nexus.order.service.OrderService;
import com.nexus.order.model.Order;
import com.nexus.order.repository.OrderRepository;
import com.nexus.order.integration.EdifactIntegration;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Comprehensive test suite for OrderService validating order processing,
 * EDIFACT integration, and data management functionality.
 *
 * @version 1.0
 * @since 2023-09-01
 */
@SpringBootTest
@ExtendWith(MockitoExtension.class)
public class OrderServiceTests {

    @Mock
    private OrderRepository orderRepository;

    @Mock
    private EdifactIntegration edifactIntegration;

    @InjectMocks
    private OrderService orderService;

    private Order testOrder;
    private String testEdifactMessage;
    private UUID testBuyerId;
    private UUID testSellerId;

    @BeforeEach
    void setUp() {
        testBuyerId = UUID.randomUUID();
        testSellerId = UUID.randomUUID();
        testOrder = createTestOrder();
        testEdifactMessage = createTestEdifactMessage();
    }

    @Test
    void testCreateOrder_Success() {
        // Arrange
        when(orderRepository.save(any(Order.class))).thenReturn(testOrder);
        when(edifactIntegration.convertOrderToEdifact(any(Order.class))).thenReturn(testEdifactMessage);

        // Act
        Order createdOrder = orderService.createOrder(testOrder);

        // Assert
        assertNotNull(createdOrder);
        assertEquals(testOrder.getOrderNumber(), createdOrder.getOrderNumber());
        assertEquals("PENDING", createdOrder.getStatus());
        verify(orderRepository).save(any(Order.class));
        verify(edifactIntegration).convertOrderToEdifact(any(Order.class));
    }

    @Test
    void testCreateOrder_ValidationFailure() {
        // Arrange
        Order invalidOrder = new Order();

        // Act & Assert
        IllegalArgumentException exception = assertThrows(
            IllegalArgumentException.class,
            () -> orderService.createOrder(invalidOrder)
        );
        assertTrue(exception.getMessage().contains("Missing required fields"));
        verify(orderRepository, never()).save(any(Order.class));
    }

    @Test
    void testUpdateOrderStatus_Success() {
        // Arrange
        String newStatus = "CONFIRMED";
        when(orderRepository.findByOrderNumber(testOrder.getOrderNumber()))
            .thenReturn(Optional.of(testOrder));
        when(orderRepository.save(any(Order.class))).thenReturn(testOrder);

        // Act
        Order updatedOrder = orderService.updateOrderStatus(testOrder.getOrderNumber(), newStatus);

        // Assert
        assertNotNull(updatedOrder);
        assertEquals(newStatus, updatedOrder.getStatus());
        verify(orderRepository).findByOrderNumber(testOrder.getOrderNumber());
        verify(orderRepository).save(any(Order.class));
    }

    @Test
    void testGetOrderByNumber_Success() {
        // Arrange
        when(orderRepository.findByOrderNumber(testOrder.getOrderNumber()))
            .thenReturn(Optional.of(testOrder));

        // Act
        Optional<Order> foundOrder = orderService.getOrderByNumber(testOrder.getOrderNumber());

        // Assert
        assertTrue(foundOrder.isPresent());
        assertEquals(testOrder.getOrderNumber(), foundOrder.get().getOrderNumber());
        verify(orderRepository).findByOrderNumber(testOrder.getOrderNumber());
    }

    @Test
    void testProcessEdifactOrder_Success() {
        // Arrange
        when(edifactIntegration.parseEdifactMessage(testEdifactMessage)).thenReturn(testOrder);
        when(orderRepository.save(any(Order.class))).thenReturn(testOrder);

        // Act
        Order processedOrder = orderService.processEdifactOrder(testEdifactMessage);

        // Assert
        assertNotNull(processedOrder);
        assertEquals(testOrder.getOrderNumber(), processedOrder.getOrderNumber());
        verify(edifactIntegration).parseEdifactMessage(testEdifactMessage);
        verify(orderRepository).save(any(Order.class));
    }

    @Test
    void testGetBuyerOrders_Success() {
        // Arrange
        Pageable pageable = PageRequest.of(0, 10);
        List<Order> orderList = List.of(testOrder);
        Page<Order> orderPage = new PageImpl<>(orderList, pageable, 1);
        when(orderRepository.findByBuyerId(testBuyerId, pageable)).thenReturn(orderPage);

        // Act
        Page<Order> result = orderService.getBuyerOrders(testBuyerId, pageable);

        // Assert
        assertNotNull(result);
        assertEquals(1, result.getTotalElements());
        assertEquals(testOrder, result.getContent().get(0));
        verify(orderRepository).findByBuyerId(testBuyerId, pageable);
    }

    @Test
    void testGetSellerOrders_Success() {
        // Arrange
        Pageable pageable = PageRequest.of(0, 10);
        List<Order> orderList = List.of(testOrder);
        Page<Order> orderPage = new PageImpl<>(orderList, pageable, 1);
        when(orderRepository.findBySellerId(testSellerId, pageable)).thenReturn(orderPage);

        // Act
        Page<Order> result = orderService.getSellerOrders(testSellerId, pageable);

        // Assert
        assertNotNull(result);
        assertEquals(1, result.getTotalElements());
        assertEquals(testOrder, result.getContent().get(0));
        verify(orderRepository).findBySellerId(testSellerId, pageable);
    }

    @Test
    void testUpdateOrderStatus_InvalidStatus() {
        // Arrange
        String invalidStatus = "INVALID_STATUS";
        when(orderRepository.findByOrderNumber(testOrder.getOrderNumber()))
            .thenReturn(Optional.of(testOrder));

        // Act & Assert
        IllegalArgumentException exception = assertThrows(
            IllegalArgumentException.class,
            () -> orderService.updateOrderStatus(testOrder.getOrderNumber(), invalidStatus)
        );
        assertTrue(exception.getMessage().contains("Invalid order status"));
        verify(orderRepository, never()).save(any(Order.class));
    }

    private Order createTestOrder() {
        Order order = new Order();
        order.setOrderNumber("ORD" + UUID.randomUUID().toString().substring(0, 8));
        order.setBuyerId(testBuyerId);
        order.setSellerId(testSellerId);
        order.setStatus("PENDING");
        order.setOrderDate(LocalDateTime.now());
        order.setTotal(new BigDecimal("1000.00"));
        order.setCurrency("USD");
        order.setItems(new ArrayList<>());
        return order;
    }

    private String createTestEdifactMessage() {
        return "UNH+1+ORDERS:D:01B:UN:EAN010'" +
               "BGM+220+12345+9'" +
               "DTM+137:20230901:203'" +
               "NAD+BY+" + testBuyerId + "'" +
               "NAD+SE+" + testSellerId + "'" +
               "UNT+5+1'";
    }
}