// @angular/core v16.x
import { Injectable } from '@angular/core';
// @angular/common/http v16.x
import { HttpClient, HttpParams } from '@angular/common/http';
// rxjs v7.x
import { Observable, throwError, of } from 'rxjs';
// rxjs/operators v7.x
import { catchError, map, retry, shareReplay } from 'rxjs/operators';

import { createApiHeaders, handleApiError, buildApiUrl } from '../../../shared/utils/api.utils';
import { environment } from '../../../environments/environment';

// Interfaces for marketplace operations
interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  eclassCode?: string;
  gtin?: string;
  organizationId: string;
  attributes: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

interface ValidationResult {
  isValid: boolean;
  eclassValidation?: {
    valid: boolean;
    errors: string[];
  };
  gtinValidation?: {
    valid: boolean;
    errors: string[];
  };
  bmecatValidation?: {
    valid: boolean;
    errors: string[];
  };
}

interface BMEcatExport {
  xml: string;
  validationResult: ValidationResult;
  timestamp: string;
}

interface PaginationParams {
  page: number;
  size: number;
  sort?: string;
}

interface ProductFilters {
  organizationId?: string;
  category?: string;
  priceRange?: {
    min: number;
    max: number;
  };
  eclassCode?: string;
  gtin?: string;
}

@Injectable({
  providedIn: 'root'
})
export class MarketplaceApiService {
  private readonly apiUrl: string;
  private readonly cacheTimeout = 300000; // 5 minutes
  private productCache: Map<string, { data: Product[]; timestamp: number }> = new Map();
  private validationCache: Map<string, { result: ValidationResult; timestamp: number }> = new Map();

  constructor(private http: HttpClient) {
    this.apiUrl = environment.apiUrl;
  }

  /**
   * Retrieves paginated list of products with optional filters and caching
   */
  getProducts(filters?: ProductFilters, pagination?: PaginationParams): Observable<Product[]> {
    const cacheKey = JSON.stringify({ filters, pagination });
    const cached = this.productCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return of(cached.data);
    }

    let params = new HttpParams()
      .set('page', pagination?.page?.toString() || '0')
      .set('size', pagination?.size?.toString() || '20');

    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value) {
          if (key === 'priceRange') {
            params = params.set('minPrice', value.min.toString());
            params = params.set('maxPrice', value.max.toString());
          } else {
            params = params.set(key, value.toString());
          }
        }
      });
    }

    const headers = createApiHeaders({
      cacheControl: 'public, max-age=300',
      compress: true
    });

    return this.http.get<Product[]>(buildApiUrl('products'), { headers, params }).pipe(
      retry(3),
      map(products => {
        this.productCache.set(cacheKey, { data: products, timestamp: Date.now() });
        return products;
      }),
      catchError(handleApiError),
      shareReplay(1)
    );
  }

  /**
   * Validates product against eCl@ss and GS1 standards
   */
  validateProductStandards(product: Product): Observable<ValidationResult> {
    const cacheKey = `${product.id}-${product.updatedAt}`;
    const cached = this.validationCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return of(cached.result);
    }

    const headers = createApiHeaders({
      contentType: 'application/json'
    });

    const validationRequests = [
      // eCl@ss validation
      this.http.post<ValidationResult>(
        buildApiUrl('standards/eclass/validate'),
        { eclassCode: product.eclassCode, attributes: product.attributes },
        { headers }
      ),
      // GTIN validation
      this.http.post<ValidationResult>(
        buildApiUrl('standards/gs1/validate'),
        { gtin: product.gtin },
        { headers }
      ),
      // BMEcat compatibility check
      this.http.post<ValidationResult>(
        buildApiUrl('standards/bmecat/validate'),
        product,
        { headers }
      )
    ];

    return this.http.forkJoin(validationRequests).pipe(
      map(([eclassResult, gtinResult, bmecatResult]) => {
        const result: ValidationResult = {
          isValid: eclassResult.isValid && gtinResult.isValid && bmecatResult.isValid,
          eclassValidation: eclassResult.eclassValidation,
          gtinValidation: gtinResult.gtinValidation,
          bmecatValidation: bmecatResult.bmecatValidation
        };
        this.validationCache.set(cacheKey, { result, timestamp: Date.now() });
        return result;
      }),
      catchError(handleApiError)
    );
  }

  /**
   * Exports products in BMEcat format
   */
  exportToBMEcat(products: Product[]): Observable<BMEcatExport> {
    const headers = createApiHeaders({
      contentType: 'application/json',
      accept: 'application/xml'
    });

    return this.http.post<BMEcatExport>(
      buildApiUrl('standards/bmecat/export'),
      { products },
      { headers }
    ).pipe(
      retry(2),
      catchError(handleApiError)
    );
  }

  /**
   * Retrieves a product by ID with standards validation
   */
  getProductById(id: string, validateStandards = false): Observable<Product> {
    const headers = createApiHeaders({
      cacheControl: 'public, max-age=300'
    });

    return this.http.get<Product>(buildApiUrl(`products/${id}`), { headers }).pipe(
      map(product => {
        if (validateStandards) {
          this.validateProductStandards(product).subscribe();
        }
        return product;
      }),
      catchError(handleApiError)
    );
  }

  /**
   * Creates a new product with standards validation
   */
  createProduct(product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>): Observable<Product> {
    const headers = createApiHeaders({
      contentType: 'application/json'
    });

    return this.http.post<Product>(buildApiUrl('products'), product, { headers }).pipe(
      catchError(handleApiError)
    );
  }

  /**
   * Updates an existing product with standards validation
   */
  updateProduct(id: string, product: Partial<Product>): Observable<Product> {
    const headers = createApiHeaders({
      contentType: 'application/json'
    });

    return this.http.put<Product>(buildApiUrl(`products/${id}`), product, { headers }).pipe(
      catchError(handleApiError)
    );
  }

  /**
   * Retrieves products by organization with standards support
   */
  getProductsByOrganization(organizationId: string, pagination?: PaginationParams): Observable<Product[]> {
    return this.getProducts({ organizationId }, pagination);
  }
}