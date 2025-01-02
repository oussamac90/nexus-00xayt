// @ngrx/store version 16.x
// @ngrx/entity version 16.x
import { createReducer, on, ActionReducerMap } from '@ngrx/store';
import { createEntityAdapter, EntityAdapter } from '@ngrx/entity';
import { 
  AppState, 
  AuthState, 
  MarketplaceState, 
  OrderState, 
  PaymentState, 
  ShippingState, 
  AnalyticsState,
  Product,
  Order,
  Transaction,
  Shipment
} from '../state';
import {
  authActions,
  marketplaceActions,
  orderActions,
  paymentActions,
  shippingActions,
  analyticsActions
} from '../actions';

// Entity adapters for efficient CRUD operations
const productAdapter: EntityAdapter<Product> = createEntityAdapter<Product>({
  selectId: (product: Product) => product.id,
  sortComparer: (a: Product, b: Product) => a.name.localeCompare(b.name)
});

const orderAdapter: EntityAdapter<Order> = createEntityAdapter<Order>({
  selectId: (order: Order) => order.id,
  sortComparer: (a: Order, b: Order) => b.createdAt.getTime() - a.createdAt.getTime()
});

const transactionAdapter: EntityAdapter<Transaction> = createEntityAdapter<Transaction>({
  selectId: (transaction: Transaction) => transaction.id,
  sortComparer: (a: Transaction, b: Transaction) => b.timestamp.getTime() - a.timestamp.getTime()
});

const shipmentAdapter: EntityAdapter<Shipment> = createEntityAdapter<Shipment>({
  selectId: (shipment: Shipment) => shipment.id,
  sortComparer: (a: Shipment, b: Shipment) => b.estimatedDelivery.getTime() - a.estimatedDelivery.getTime()
});

// Auth reducer with enhanced error handling
export const authReducer = createReducer<AuthState>(
  {
    user: null,
    isAuthenticated: false,
    loading: false,
    error: null
  },
  on(authActions.login, (state) => ({
    ...state,
    loading: true,
    error: null
  })),
  on(authActions.loginSuccess, (state, { user }) => ({
    ...state,
    user,
    isAuthenticated: true,
    loading: false,
    error: null
  })),
  on(authActions.loginFailure, (state, { error }) => ({
    ...state,
    user: null,
    isAuthenticated: false,
    loading: false,
    error: error.message
  })),
  on(authActions.logout, (state) => ({
    ...state,
    user: null,
    isAuthenticated: false,
    loading: false,
    error: null
  }))
);

// Marketplace reducer with entity adapter integration
export const marketplaceReducer = createReducer<MarketplaceState>(
  {
    products: productAdapter.getInitialState(),
    selectedProduct: null,
    loading: false,
    error: null
  },
  on(marketplaceActions.loadProducts, (state) => ({
    ...state,
    loading: true,
    error: null
  })),
  on(marketplaceActions.loadProductsSuccess, (state, { products }) => ({
    ...state,
    products: productAdapter.setAll(products, state.products),
    loading: false,
    error: null
  })),
  on(marketplaceActions.loadProductsFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error: error.message
  })),
  on(marketplaceActions.selectProduct, (state, { productId }) => ({
    ...state,
    selectedProduct: state.products.entities[productId] || null
  })),
  on(marketplaceActions.updateProduct, (state, { product }) => ({
    ...state,
    products: productAdapter.updateOne({
      id: product.id,
      changes: product
    }, state.products)
  }))
);

// Order reducer with optimistic updates
export const orderReducer = createReducer<OrderState>(
  {
    orders: orderAdapter.getInitialState(),
    selectedOrder: null,
    loading: false,
    error: null
  },
  on(orderActions.loadOrders, (state) => ({
    ...state,
    loading: true,
    error: null
  })),
  on(orderActions.loadOrdersSuccess, (state, { orders }) => ({
    ...state,
    orders: orderAdapter.setAll(orders, state.orders),
    loading: false,
    error: null
  })),
  on(orderActions.loadOrdersFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error: error.message
  })),
  on(orderActions.createOrder, (state, { order }) => ({
    ...state,
    loading: true,
    error: null
  })),
  on(orderActions.updateOrderStatus, (state, { orderId, status }) => ({
    ...state,
    orders: orderAdapter.updateOne({
      id: orderId,
      changes: { status, updatedAt: new Date() }
    }, state.orders)
  }))
);

// Payment reducer with transaction tracking
export const paymentReducer = createReducer<PaymentState>(
  {
    transactions: transactionAdapter.getInitialState(),
    currentTransaction: null,
    loading: false,
    error: null
  },
  on(paymentActions.processPayment, (state) => ({
    ...state,
    loading: true,
    error: null
  })),
  on(paymentActions.processPaymentSuccess, (state, { transaction }) => ({
    ...state,
    transactions: transactionAdapter.addOne(transaction, state.transactions),
    currentTransaction: transaction,
    loading: false,
    error: null
  })),
  on(paymentActions.processPaymentFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error: error.message
  }))
);

// Shipping reducer with tracking updates
export const shippingReducer = createReducer<ShippingState>(
  {
    shipments: shipmentAdapter.getInitialState(),
    selectedShipment: null,
    loading: false,
    error: null
  },
  on(shippingActions.createShipment, (state) => ({
    ...state,
    loading: true,
    error: null
  })),
  on(shippingActions.trackShipmentSuccess, (state, { shipment }) => ({
    ...state,
    shipments: shipmentAdapter.upsertOne(shipment, state.shipments),
    selectedShipment: shipment,
    loading: false,
    error: null
  })),
  on(shippingActions.trackShipmentFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error: error.message
  }))
);

// Analytics reducer with metrics handling
export const analyticsReducer = createReducer<AnalyticsState>(
  {
    metrics: null,
    dateRange: null,
    loading: false,
    error: null
  },
  on(analyticsActions.loadMetrics, (state, { dateRange }) => ({
    ...state,
    dateRange,
    loading: true,
    error: null
  })),
  on(analyticsActions.loadMetricsSuccess, (state, { metrics }) => ({
    ...state,
    metrics,
    loading: false,
    error: null
  })),
  on(analyticsActions.loadMetricsFailure, (state, { error }) => ({
    ...state,
    loading: false,
    error: error.message
  }))
);

// Root reducer map combining all feature reducers
export const reducers: ActionReducerMap<AppState> = {
  auth: authReducer,
  marketplace: marketplaceReducer,
  orders: orderReducer,
  payments: paymentReducer,
  shipping: shippingReducer,
  analytics: analyticsReducer
};