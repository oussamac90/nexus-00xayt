// @ngrx/store version 16.x
import { createFeatureSelector, createSelector } from '@ngrx/store';
import {
  AppState,
  AuthState,
  MarketplaceState,
  OrderState,
  PaymentState,
  ShippingState,
  AnalyticsState,
  User,
  Product,
  Order,
  Transaction,
  Shipment,
  Metrics,
  DateRange
} from '../state';

/**
 * Feature keys for state slices
 */
export const FEATURE_KEYS = {
  auth: 'auth',
  marketplace: 'marketplace',
  orders: 'orders',
  payments: 'payments',
  shipping: 'shipping',
  analytics: 'analytics'
} as const;

/**
 * Selector metadata for monitoring and debugging
 */
export const SELECTOR_METADATA = {
  version: '1.0',
  performance_threshold_ms: 5,
  enable_debug: false,
  enable_monitoring: true
} as const;

// Auth Feature Selectors
export const selectAuthState = createFeatureSelector<AppState, AuthState>(FEATURE_KEYS.auth);

export const selectUser = createSelector(
  selectAuthState,
  (state: AuthState): User | null => state.user
);

export const selectIsAuthenticated = createSelector(
  selectAuthState,
  (state: AuthState): boolean => state.isAuthenticated
);

export const selectAuthLoading = createSelector(
  selectAuthState,
  (state: AuthState): boolean => state.loading
);

export const selectAuthError = createSelector(
  selectAuthState,
  (state: AuthState): string | null => state.error
);

// Marketplace Feature Selectors
export const selectMarketplaceState = createFeatureSelector<AppState, MarketplaceState>(FEATURE_KEYS.marketplace);

export const selectAllProducts = createSelector(
  selectMarketplaceState,
  (state: MarketplaceState): Product[] => Object.values(state.products.entities)
);

export const selectSelectedProduct = createSelector(
  selectMarketplaceState,
  (state: MarketplaceState): Product | null => state.selectedProduct
);

export const selectMarketplaceLoading = createSelector(
  selectMarketplaceState,
  (state: MarketplaceState): boolean => state.loading
);

export const selectMarketplaceError = createSelector(
  selectMarketplaceState,
  (state: MarketplaceState): string | null => state.error
);

// Order Feature Selectors
export const selectOrderState = createFeatureSelector<AppState, OrderState>(FEATURE_KEYS.orders);

export const selectAllOrders = createSelector(
  selectOrderState,
  (state: OrderState): Order[] => Object.values(state.orders.entities)
);

export const selectSelectedOrder = createSelector(
  selectOrderState,
  (state: OrderState): Order | null => state.selectedOrder
);

export const selectOrderLoading = createSelector(
  selectOrderState,
  (state: OrderState): boolean => state.loading
);

export const selectOrderError = createSelector(
  selectOrderState,
  (state: OrderState): string | null => state.error
);

// Payment Feature Selectors
export const selectPaymentState = createFeatureSelector<AppState, PaymentState>(FEATURE_KEYS.payments);

export const selectAllTransactions = createSelector(
  selectPaymentState,
  (state: PaymentState): Transaction[] => Object.values(state.transactions.entities)
);

export const selectCurrentTransaction = createSelector(
  selectPaymentState,
  (state: PaymentState): Transaction | null => state.currentTransaction
);

export const selectPaymentLoading = createSelector(
  selectPaymentState,
  (state: PaymentState): boolean => state.loading
);

export const selectPaymentError = createSelector(
  selectPaymentState,
  (state: PaymentState): string | null => state.error
);

// Shipping Feature Selectors
export const selectShippingState = createFeatureSelector<AppState, ShippingState>(FEATURE_KEYS.shipping);

export const selectAllShipments = createSelector(
  selectShippingState,
  (state: ShippingState): Shipment[] => Object.values(state.shipments.entities)
);

export const selectSelectedShipment = createSelector(
  selectShippingState,
  (state: ShippingState): Shipment | null => state.selectedShipment
);

export const selectShippingLoading = createSelector(
  selectShippingState,
  (state: ShippingState): boolean => state.loading
);

export const selectShippingError = createSelector(
  selectShippingState,
  (state: ShippingState): string | null => state.error
);

// Analytics Feature Selectors
export const selectAnalyticsState = createFeatureSelector<AppState, AnalyticsState>(FEATURE_KEYS.analytics);

export const selectMetrics = createSelector(
  selectAnalyticsState,
  (state: AnalyticsState): Metrics | null => state.metrics
);

export const selectDateRange = createSelector(
  selectAnalyticsState,
  (state: AnalyticsState): DateRange | null => state.dateRange
);

export const selectAnalyticsLoading = createSelector(
  selectAnalyticsState,
  (state: AnalyticsState): boolean => state.loading
);

export const selectAnalyticsError = createSelector(
  selectAnalyticsState,
  (state: AnalyticsState): string | null => state.error
);

// Derived/Computed Selectors
export const selectOrdersWithShipments = createSelector(
  selectAllOrders,
  selectAllShipments,
  (orders: Order[], shipments: Shipment[]): Array<Order & { shipment: Shipment | null }> => {
    return orders.map(order => ({
      ...order,
      shipment: shipments.find(shipment => shipment.orderId === order.id) || null
    }));
  }
);

export const selectOrderWithDetails = createSelector(
  selectSelectedOrder,
  selectAllProducts,
  selectCurrentTransaction,
  selectSelectedShipment,
  (order: Order | null, products: Product[], transaction: Transaction | null, shipment: Shipment | null) => {
    if (!order) return null;
    return {
      ...order,
      items: order.items.map(item => ({
        ...item,
        product: products.find(p => p.id === item.productId)
      })),
      transaction,
      shipment
    };
  }
);

export const selectDashboardMetrics = createSelector(
  selectMetrics,
  selectAllOrders,
  selectAllTransactions,
  (metrics: Metrics | null, orders: Order[], transactions: Transaction[]): any => {
    if (!metrics) return null;
    return {
      ...metrics,
      recentOrders: orders.slice(-5),
      recentTransactions: transactions.slice(-5)
    };
  }
);