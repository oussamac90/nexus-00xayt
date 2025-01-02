package com.nexus.product;

import com.nexus.product.service.ProductService;
import com.nexus.product.model.Product;
import com.nexus.product.repository.ProductRepository;
import com.nexus.product.integration.EclassIntegration;
import com.nexus.product.integration.GS1Integration;
import com.nexus.common.security.SecurityContext;
import com.nexus.common.exception.ValidationException;
import com.nexus.common.exception.ResourceNotFoundException;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.InjectMocks;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.cache.CacheManager;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

import java.math.BigDecimal;
import java.util.*;
import java.util.concurrent.CompletableFuture;

import static org.mockito.Mockito.*;
import static org.junit.jupiter.api.Assertions.*;

/**
 * Comprehensive test suite for ProductService verifying product management operations,
 * standards compliance, caching behavior, and bulk operations.
 */
@SpringBootTest
@ExtendWith(MockitoExtension.class)
public class ProductServiceTests {

    @MockBean
    private ProductRepository productRepository;

    @MockBean
    private EclassIntegration eclassIntegration;

    @MockBean
    private GS1Integration gs1Integration;

    @MockBean
    private SecurityContext securityContext;

    @MockBean
    private CacheManager cacheManager;

    @InjectMocks
    private ProductService productService;

    private UUID organizationId;
    private UUID userId;

    @BeforeEach
    void setUp() {
        organizationId = UUID.randomUUID();
        userId = UUID.randomUUID();
        
        when(securityContext.getCurrentOrganizationId()).thenReturn(organizationId);
        when(securityContext.getCurrentUser()).thenReturn(userId.toString());
    }

    @Test
    void testCreateProduct_Success() {
        // Arrange
        Product product = createTestProduct();
        when(gs1Integration.validateGTIN(product.getGtin())).thenReturn(true);
        when(eclassIntegration.validateCode(product.getEclassCode())).thenReturn(true);
        when(productRepository.save(any(Product.class))).thenReturn(product);

        // Act
        Product created = productService.createProduct(product);

        // Assert
        assertNotNull(created);
        assertEquals(product.getSku(), created.getSku());
        verify(productRepository).save(any(Product.class));
        verify(gs1Integration).validateGTIN(product.getGtin());
        verify(eclassIntegration).validateCode(product.getEclassCode());
    }

    @Test
    void testCreateProduct_InvalidGTIN() {
        // Arrange
        Product product = createTestProduct();
        when(gs1Integration.validateGTIN(product.getGtin())).thenReturn(false);

        // Act & Assert
        assertThrows(ValidationException.class, () -> productService.createProduct(product));
        verify(productRepository, never()).save(any(Product.class));
    }

    @Test
    void testBulkProductCreation_Success() {
        // Arrange
        List<Product> products = Arrays.asList(
            createTestProduct(),
            createTestProduct()
        );
        when(gs1Integration.validateGTIN(anyString())).thenReturn(true);
        when(eclassIntegration.validateCode(anyString())).thenReturn(true);
        when(productRepository.saveAll(anyList())).thenReturn(products);

        // Act
        CompletableFuture<List<Product>> future = productService.bulkClassifyProducts(products);

        // Assert
        assertNotNull(future);
        List<Product> created = future.join();
        assertEquals(2, created.size());
        verify(productRepository).saveAll(anyList());
        verify(eclassIntegration).classifyProducts(anyList());
    }

    @Test
    void testProductSearch_WithCaching() {
        // Arrange
        Pageable pageable = PageRequest.of(0, 10);
        Map<String, Object> filters = new HashMap<>();
        filters.put("active", true);
        
        List<Product> products = Collections.singletonList(createTestProduct());
        Page<Product> productPage = new PageImpl<>(products);
        
        when(productRepository.findAll(any(), any(Pageable.class))).thenReturn(productPage);

        // Act - First call (cache miss)
        Page<Product> result1 = productService.searchProducts("test", filters, null, pageable);
        
        // Act - Second call (cache hit)
        Page<Product> result2 = productService.searchProducts("test", filters, null, pageable);

        // Assert
        assertNotNull(result1);
        assertNotNull(result2);
        assertEquals(1, result1.getContent().size());
        verify(productRepository, times(1)).findAll(any(), any(Pageable.class));
    }

    @Test
    void testUpdateProduct_Success() {
        // Arrange
        UUID productId = UUID.randomUUID();
        Product existing = createTestProduct();
        Product updated = createTestProduct();
        updated.setName("Updated Name");
        
        when(productRepository.findById(productId)).thenReturn(Optional.of(existing));
        when(productRepository.save(any(Product.class))).thenReturn(updated);
        when(gs1Integration.validateGTIN(anyString())).thenReturn(true);
        when(eclassIntegration.validateCode(anyString())).thenReturn(true);

        // Act
        Product result = productService.updateProduct(productId, updated);

        // Assert
        assertNotNull(result);
        assertEquals("Updated Name", result.getName());
        verify(productRepository).save(any(Product.class));
    }

    @Test
    void testUpdateProduct_NotFound() {
        // Arrange
        UUID productId = UUID.randomUUID();
        Product updated = createTestProduct();
        when(productRepository.findById(productId)).thenReturn(Optional.empty());

        // Act & Assert
        assertThrows(ResourceNotFoundException.class, 
            () -> productService.updateProduct(productId, updated));
    }

    private Product createTestProduct() {
        Product product = new Product();
        product.setSku("TEST-SKU-" + UUID.randomUUID().toString().substring(0, 8));
        product.setName("Test Product");
        product.setDescription("Test Description");
        product.setGtin("12345678901234");
        product.setEclassCode("12345678");
        product.setPrice(new BigDecimal("99.99"));
        product.setCurrency("USD");
        product.setMinOrderQuantity(1);
        product.setUnit("PCS");
        product.setActive(true);
        
        Organization org = new Organization();
        org.setId(organizationId);
        product.setOrganization(org);
        
        return product;
    }
}