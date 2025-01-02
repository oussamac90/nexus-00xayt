// @ngrx/entity version 16.x
import { EntityState } from '@ngrx/entity';

/**
 * Root state interface combining all feature states for the Nexus Platform
 */
export interface AppState {
  auth: AuthState;
  marketplace: MarketplaceState;
  orders: OrderState;
  payments: PaymentState;
  shipping: ShippingState;
  analytics: AnalyticsState;
}

/**
 * Authentication state interface managing user session and auth status
 */
export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
}

/**
 * Marketplace feature state interface handling product catalog and selection
 */
export interface MarketplaceState {
  products: EntityState<Product>;
  selectedProduct: Product | null;
  loading: boolean;
  error: string | null;
}

/**
 * Order management state interface tracking orders and processing status
 */
export interface OrderState {
  orders: EntityState<Order>;
  selectedOrder: Order | null;
  loading: boolean;
  error: string | null;
}

/**
 * Payment processing state interface managing transactions
 */
export interface PaymentState {
  transactions: EntityState<Transaction>;
  currentTransaction: Transaction | null;
  loading: boolean;
  error: string | null;
}

/**
 * Shipping management state interface handling shipment tracking
 */
export interface ShippingState {
  shipments: EntityState<Shipment>;
  selectedShipment: Shipment | null;
  loading: boolean;
  error: string | null;
}

/**
 * Analytics and reporting state interface for metrics and data analysis
 */
export interface AnalyticsState {
  metrics: Metrics;
  dateRange: DateRange;
  loading: boolean;
  error: string | null;
}

/**
 * Initial state configuration for the entire application
 */
export const initialState: AppState = {
  auth: {
    user: null,
    isAuthenticated: false,
    loading: false,
    error: null
  },
  marketplace: {
    products: {
      ids: [],
      entities: {}
    },
    selectedProduct: null,
    loading: false,
    error: null
  },
  orders: {
    orders: {
      ids: [],
      entities: {}
    },
    selectedOrder: null,
    loading: false,
    error: null
  },
  payments: {
    transactions: {
      ids: [],
      entities: {}
    },
    currentTransaction: null,
    loading: false,
    error: null
  },
  shipping: {
    shipments: {
      ids: [],
      entities: {}
    },
    selectedShipment: null,
    loading: false,
    error: null
  },
  analytics: {
    metrics: null,
    dateRange: null,
    loading: false,
    error: null
  }
};

/**
 * Type definitions for state interfaces
 */
export interface User {
  id: string;
  email: string;
  profile: UserProfile;
  roles: string[];
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  description: string;
  price: number;
  category: string;
  attributes: Record<string, any>;
}

export interface Order {
  id: string;
  customerId: string;
  items: OrderItem[];
  status: OrderStatus;
  total: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Transaction {
  id: string;
  orderId: string;
  amount: number;
  status: PaymentStatus;
  method: PaymentMethod;
  timestamp: Date;
}

export interface Shipment {
  id: string;
  orderId: string;
  carrier: string;
  trackingNumber: string;
  status: ShipmentStatus;
  estimatedDelivery: Date;
}

export interface Metrics {
  revenue: number;
  orders: number;
  averageOrderValue: number;
  topProducts: Product[];
}

export interface DateRange {
  start: Date;
  end: Date;
}

export interface UserProfile {
  firstName: string;
  lastName: string;
  company: string;
  phone: string;
}

export interface OrderItem {
  productId: string;
  quantity: number;
  price: number;
}

export enum OrderStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  SHIPPED = 'SHIPPED',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED'
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  AUTHORIZED = 'AUTHORIZED',
  CAPTURED = 'CAPTURED',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED'
}

export enum PaymentMethod {
  CREDIT_CARD = 'CREDIT_CARD',
  BANK_TRANSFER = 'BANK_TRANSFER',
  DIGITAL_WALLET = 'DIGITAL_WALLET'
}

export enum ShipmentStatus {
  PENDING = 'PENDING',
  PICKED = 'PICKED',
  PACKED = 'PACKED',
  IN_TRANSIT = 'IN_TRANSIT',
  DELIVERED = 'DELIVERED'
}