// @angular/core v16.x
import { Injectable } from '@angular/core';
// @angular/common/http v16.x
import { 
  HttpClient, 
  HttpHeaders, 
  HttpParams, 
  HttpErrorResponse 
} from '@angular/common/http';
// rxjs v7.x
import { Observable, throwError, of } from 'rxjs';
// rxjs/operators v7.x
import { 
  catchError, 
  map, 
  retry, 
  timeout, 
  finalize 
} from 'rxjs/operators';
import { apiUrl } from '../../../../environments/environment';

// API endpoint constants
const API_ENDPOINTS = {
  SHIPMENTS: '/api/v1/shipping/orders',
  TRACKING: '/api/v1/shipping/shipments',
  LABELS: '/api/v1/shipping/shipments',
  CUSTOMS: '/api/v1/shipping/shipments'
} as const;

// Configuration constants
const HTTP_TIMEOUT = 30000; // 30 seconds
const MAX_RETRIES = 3;

// Type definitions
interface ShippingDetails {
  carrier: string;
  service: string;
  recipientAddress: Address;
  dimensions: Dimensions;
  weight: Weight;
  insurance?: Insurance;
}

interface Address {
  name: string;
  street: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  phone: string;
}

interface Dimensions {
  length: number;
  width: number;
  height: number;
  unit: 'cm' | 'in';
}

interface Weight {
  value: number;
  unit: 'kg' | 'lb';
}

interface Insurance {
  value: number;
  currency: string;
}

interface Shipment {
  id: string;
  orderId: string;
  trackingNumber: string;
  carrier: string;
  status: ShipmentStatus;
  label?: string;
  createdAt: string;
  updatedAt: string;
}

interface ShipmentPage {
  items: Shipment[];
  total: number;
  page: number;
  pageSize: number;
}

interface PaginationOptions {
  page: number;
  pageSize: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

interface TrackingDetails {
  status: ShipmentStatus;
  location?: string;
  timestamp: string;
  notes?: string;
}

type ShipmentStatus = 
  | 'created'
  | 'label_generated'
  | 'picked_up'
  | 'in_transit'
  | 'out_for_delivery'
  | 'delivered'
  | 'exception';

type LabelFormat = 'pdf' | 'zpl' | 'png';

interface CustomsOptions {
  declarationType: string;
  contents: CustomsItem[];
  invoiceNumber?: string;
  reasonForExport?: string;
}

interface CustomsItem {
  description: string;
  quantity: number;
  value: number;
  weight: number;
  hsCode?: string;
  originCountry: string;
}

interface CustomsDocuments {
  commercialInvoice?: string;
  certificateOfOrigin?: string;
  declarationForm: string;
  packingList: string;
}

@Injectable({
  providedIn: 'root'
})
export class ShippingApiService {
  private readonly apiUrl: string;
  private readonly defaultHeaders: HttpHeaders;
  private readonly defaultTimeout: number;
  private readonly maxRetries: number;

  constructor(private http: HttpClient) {
    this.apiUrl = apiUrl;
    this.defaultHeaders = new HttpHeaders({
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    });
    this.defaultTimeout = HTTP_TIMEOUT;
    this.maxRetries = MAX_RETRIES;
  }

  createShipment(orderId: string, shippingDetails: ShippingDetails): Observable<Shipment> {
    if (!orderId || !shippingDetails) {
      return throwError(() => new Error('Invalid shipment parameters'));
    }

    const url = `${this.apiUrl}${API_ENDPOINTS.SHIPMENTS}/${orderId}`;
    const headers = this.getCarrierSpecificHeaders(shippingDetails.carrier);

    return this.http.post<Shipment>(url, shippingDetails, { headers })
      .pipe(
        timeout(this.defaultTimeout),
        retry(this.maxRetries),
        map(response => this.transformShipmentResponse(response)),
        catchError(this.handleError),
        finalize(() => this.logShipmentCreation(orderId))
      );
  }

  getShipmentsByOrder(orderId: string, options: PaginationOptions): Observable<ShipmentPage> {
    if (!orderId) {
      return throwError(() => new Error('Order ID is required'));
    }

    const url = `${this.apiUrl}${API_ENDPOINTS.SHIPMENTS}/${orderId}`;
    const params = new HttpParams()
      .set('page', options.page.toString())
      .set('pageSize', options.pageSize.toString())
      .set('sortBy', options.sortBy || 'createdAt')
      .set('sortOrder', options.sortOrder || 'desc');

    return this.http.get<ShipmentPage>(url, { 
      headers: this.defaultHeaders,
      params 
    }).pipe(
      timeout(this.defaultTimeout),
      retry(this.maxRetries),
      catchError(this.handleError)
    );
  }

  updateTrackingStatus(trackingNumber: string, trackingDetails: TrackingDetails): Observable<Shipment> {
    if (!this.isValidTrackingNumber(trackingNumber)) {
      return throwError(() => new Error('Invalid tracking number'));
    }

    const url = `${this.apiUrl}${API_ENDPOINTS.TRACKING}/${trackingNumber}/status`;
    
    return this.http.put<Shipment>(url, trackingDetails, {
      headers: this.defaultHeaders
    }).pipe(
      timeout(this.defaultTimeout),
      retry(this.maxRetries),
      map(response => this.transformShipmentResponse(response)),
      catchError(this.handleError)
    );
  }

  generateShippingLabel(trackingNumber: string, format: LabelFormat = 'pdf'): Observable<Blob> {
    if (!this.isValidTrackingNumber(trackingNumber)) {
      return throwError(() => new Error('Invalid tracking number'));
    }

    const url = `${this.apiUrl}${API_ENDPOINTS.LABELS}/${trackingNumber}/label`;
    const headers = new HttpHeaders({
      'Accept': this.getLabelContentType(format)
    });

    return this.http.post(url, { format }, {
      headers,
      responseType: 'blob'
    }).pipe(
      timeout(this.defaultTimeout),
      retry(this.maxRetries),
      catchError(this.handleError)
    );
  }

  generateCustomsDocuments(trackingNumber: string, options: CustomsOptions): Observable<CustomsDocuments> {
    if (!this.isValidTrackingNumber(trackingNumber) || !this.isValidCustomsOptions(options)) {
      return throwError(() => new Error('Invalid customs documentation parameters'));
    }

    const url = `${this.apiUrl}${API_ENDPOINTS.CUSTOMS}/${trackingNumber}/customs`;

    return this.http.post<CustomsDocuments>(url, options, {
      headers: this.defaultHeaders
    }).pipe(
      timeout(this.defaultTimeout),
      retry(this.maxRetries),
      map(response => this.validateCustomsDocuments(response)),
      catchError(this.handleError)
    );
  }

  private getCarrierSpecificHeaders(carrier: string): HttpHeaders {
    let headers = this.defaultHeaders;
    if (carrier) {
      headers = headers.set('X-Carrier-Id', carrier);
    }
    return headers;
  }

  private isValidTrackingNumber(trackingNumber: string): boolean {
    return /^[A-Z0-9]{8,30}$/.test(trackingNumber);
  }

  private isValidCustomsOptions(options: CustomsOptions): boolean {
    return !!(options.declarationType && 
              options.contents && 
              options.contents.length > 0);
  }

  private getLabelContentType(format: LabelFormat): string {
    const contentTypes = {
      'pdf': 'application/pdf',
      'zpl': 'application/zpl',
      'png': 'image/png'
    };
    return contentTypes[format];
  }

  private transformShipmentResponse(response: any): Shipment {
    return {
      ...response,
      createdAt: new Date(response.createdAt).toISOString(),
      updatedAt: new Date(response.updatedAt).toISOString()
    };
  }

  private validateCustomsDocuments(documents: CustomsDocuments): CustomsDocuments {
    if (!documents.declarationForm || !documents.packingList) {
      throw new Error('Incomplete customs documentation');
    }
    return documents;
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    let errorMessage = 'An error occurred';
    
    if (error.error instanceof ErrorEvent) {
      // Client-side error
      errorMessage = `Client Error: ${error.error.message}`;
    } else {
      // Server-side error
      errorMessage = `Server Error: ${error.status} - ${error.message}`;
    }

    console.error('ShippingApiService Error:', errorMessage);
    return throwError(() => new Error(errorMessage));
  }

  private logShipmentCreation(orderId: string): void {
    console.debug(`Shipment created for order: ${orderId}`);
  }
}