// @ngrx/store version 16.x
import { createAction, props } from '@ngrx/store';
import {
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

// Action source constants for better organization and tracking
export const ACTION_SOURCES = {
  AUTH: '[Auth]',
  MARKETPLACE: '[Marketplace]',
  ORDERS: '[Orders]',
  PAYMENTS: '[Payments]',
  SHIPPING: '[Shipping]',
  ANALYTICS: '[Analytics]'
} as const;

// Authentication Actions
export const authActions = {
  login: createAction(
    `${ACTION_SOURCES.AUTH} Login`,
    props<{ credentials: { email: string; password: string } }>()
  ),
  loginSuccess: createAction(
    `${ACTION_SOURCES.AUTH} Login Success`,
    props<{ user: AuthState['user'] }>()
  ),
  loginFailure: createAction(
    `${ACTION_SOURCES.AUTH} Login Failure`,
    props<{ error: { code: string; message: string } }>()
  ),
  logout: createAction(`${ACTION_SOURCES.AUTH} Logout`),
  logoutSuccess: createAction(`${ACTION_SOURCES.AUTH} Logout Success`),
  checkAuth: createAction(`${ACTION_SOURCES.AUTH} Check Auth Status`),
  updateProfile: createAction(
    `${ACTION_SOURCES.AUTH} Update Profile`,
    props<{ user: Partial<User> }>()
  )
};

// Marketplace Actions
export const marketplaceActions = {
  loadProducts: createAction(
    `${ACTION_SOURCES.MARKETPLACE} Load Products`,
    props<{ filters?: MarketplaceState['filters'] }>()
  ),
  loadProductsSuccess: createAction(
    `${ACTION_SOURCES.MARKETPLACE} Load Products Success`,
    props<{ products: Product[] }>()
  ),
  loadProductsFailure: createAction(
    `${ACTION_SOURCES.MARKETPLACE} Load Products Failure`,
    props<{ error: { code: string; message: string } }>()
  ),
  selectProduct: createAction(
    `${ACTION_SOURCES.MARKETPLACE} Select Product`,
    props<{ productId: string }>()
  ),
  updateProduct: createAction(
    `${ACTION_SOURCES.MARKETPLACE} Update Product`,
    props<{ product: Partial<Product> }>()
  )
};

// Order Actions
export const orderActions = {
  loadOrders: createAction(
    `${ACTION_SOURCES.ORDERS} Load Orders`,
    props<{ filters?: Partial<OrderState['filters']> }>()
  ),
  loadOrdersSuccess: createAction(
    `${ACTION_SOURCES.ORDERS} Load Orders Success`,
    props<{ orders: Order[] }>()
  ),
  loadOrdersFailure: createAction(
    `${ACTION_SOURCES.ORDERS} Load Orders Failure`,
    props<{ error: { code: string; message: string } }>()
  ),
  createOrder: createAction(
    `${ACTION_SOURCES.ORDERS} Create Order`,
    props<{ order: Omit<Order, 'id'> }>()
  ),
  updateOrderStatus: createAction(
    `${ACTION_SOURCES.ORDERS} Update Status`,
    props<{ orderId: string; status: Order['status'] }>()
  )
};

// Payment Actions
export const paymentActions = {
  processPayment: createAction(
    `${ACTION_SOURCES.PAYMENTS} Process Payment`,
    props<{ transaction: Omit<Transaction, 'id' | 'timestamp'> }>()
  ),
  processPaymentSuccess: createAction(
    `${ACTION_SOURCES.PAYMENTS} Process Payment Success`,
    props<{ transaction: Transaction }>()
  ),
  processPaymentFailure: createAction(
    `${ACTION_SOURCES.PAYMENTS} Process Payment Failure`,
    props<{ error: { code: string; message: string } }>()
  ),
  loadTransactions: createAction(
    `${ACTION_SOURCES.PAYMENTS} Load Transactions`,
    props<{ orderId?: string }>()
  )
};

// Shipping Actions
export const shippingActions = {
  createShipment: createAction(
    `${ACTION_SOURCES.SHIPPING} Create Shipment`,
    props<{ shipment: Omit<Shipment, 'id'> }>()
  ),
  updateShipmentStatus: createAction(
    `${ACTION_SOURCES.SHIPPING} Update Status`,
    props<{ shipmentId: string; status: Shipment['status'] }>()
  ),
  trackShipment: createAction(
    `${ACTION_SOURCES.SHIPPING} Track Shipment`,
    props<{ trackingNumber: string }>()
  ),
  trackShipmentSuccess: createAction(
    `${ACTION_SOURCES.SHIPPING} Track Shipment Success`,
    props<{ shipment: Shipment }>()
  ),
  trackShipmentFailure: createAction(
    `${ACTION_SOURCES.SHIPPING} Track Shipment Failure`,
    props<{ error: { code: string; message: string } }>()
  )
};

// Analytics Actions
export const analyticsActions = {
  loadMetrics: createAction(
    `${ACTION_SOURCES.ANALYTICS} Load Metrics`,
    props<{ dateRange: DateRange }>()
  ),
  loadMetricsSuccess: createAction(
    `${ACTION_SOURCES.ANALYTICS} Load Metrics Success`,
    props<{ metrics: Metrics }>()
  ),
  loadMetricsFailure: createAction(
    `${ACTION_SOURCES.ANALYTICS} Load Metrics Failure`,
    props<{ error: { code: string; message: string } }>()
  ),
  updateDateRange: createAction(
    `${ACTION_SOURCES.ANALYTICS} Update Date Range`,
    props<{ dateRange: DateRange }>()
  )
};

// Helper function to create typed action groups
export function createActionGroup<T extends Record<string, any>>(
  source: string,
  actions: T
): T {
  return Object.keys(actions).reduce((acc, key) => {
    acc[key] = createAction(
      `${source} ${key}`,
      actions[key].props ? props<typeof actions[key].props>() : undefined
    );
    return acc;
  }, {} as T);
}