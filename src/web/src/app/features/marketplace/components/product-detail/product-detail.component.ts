// @angular/core v16.x
import { Component, OnInit, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, BehaviorSubject, takeUntil } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';

import { MarketplaceApiService } from '../../services/marketplace-api.service';
import { AuthService } from '../../../../core/auth/auth.service';
import { DataGridComponent } from '../../../../shared/components/data-grid/data-grid.component';

interface ColumnDefinition {
  key: string;
  header: string;
  sortable?: boolean;
  type?: string;
  width?: string;
}

@Component({
  selector: 'app-product-detail',
  templateUrl: './product-detail.component.html',
  styleUrls: ['./product-detail.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProductDetailComponent implements OnInit, OnDestroy {
  // State management
  product$ = new BehaviorSubject<any>(null);
  isLoading = false;
  canEdit = false;
  mfaRequired = false;
  destroy$ = new Subject<void>();
  correlationId: string;

  // Grid configuration for specifications
  specificationColumns: ColumnDefinition[] = [
    { key: 'attribute', header: 'Attribute', sortable: true, width: '30%' },
    { key: 'value', header: 'Value', sortable: true, width: '40%' },
    { key: 'eclassCode', header: 'eCl@ss Code', sortable: true, width: '30%' }
  ];

  // Responsive configuration
  responsiveConfig = {
    breakpoints: {
      xs: { columns: ['attribute', 'value'] },
      sm: { columns: ['attribute', 'value', 'eclassCode'] },
      md: { columns: ['attribute', 'value', 'eclassCode'] },
      lg: { columns: ['attribute', 'value', 'eclassCode'] }
    }
  };

  constructor(
    private marketplaceService: MarketplaceApiService,
    private authService: AuthService,
    private route: ActivatedRoute,
    private router: Router,
    private dialog: MatDialog
  ) {
    this.correlationId = crypto.randomUUID();
  }

  ngOnInit(): void {
    // Load product details with route param subscription
    this.route.params.pipe(
      takeUntil(this.destroy$)
    ).subscribe(params => {
      if (params['id']) {
        this.loadProduct(params['id']);
      } else {
        this.router.navigate(['/marketplace']);
      }
    });

    // Setup user permissions
    this.setupPermissions();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private async loadProduct(productId: string): Promise<void> {
    try {
      this.isLoading = true;
      
      // Load product with standards validation
      const product = await this.marketplaceService.getProductById(
        productId, 
        true // Enable standards validation
      ).toPromise();

      if (product) {
        // Validate product standards
        const validationResult = await this.marketplaceService.validateProductStandards(product).toPromise();
        
        if (!validationResult.isValid) {
          console.warn('Product standards validation failed:', validationResult);
        }

        // Update product state with validation results
        this.product$.next({
          ...product,
          standardsValidation: validationResult
        });
      }
    } catch (error) {
      console.error('Error loading product:', error);
      this.router.navigate(['/marketplace']);
    } finally {
      this.isLoading = false;
    }
  }

  private async setupPermissions(): Promise<void> {
    // Check user permissions with role-based access
    const hasEditPermission = this.authService.hasRole('PRODUCT_EDITOR');
    const currentUser = this.authService.getCurrentUser();
    
    // Determine if MFA is required for editing
    this.mfaRequired = hasEditPermission && currentUser?.mfaEnabled;
    this.canEdit = hasEditPermission;
  }

  async onEdit(): Promise<void> {
    if (!this.canEdit) {
      return;
    }

    try {
      // Verify MFA if required
      if (this.mfaRequired) {
        const mfaVerified = await this.authService.verifyMfa(
          this.product$.value?.id,
          'PRODUCT_EDIT'
        ).toPromise();

        if (!mfaVerified) {
          return;
        }
      }

      // Open edit dialog
      const dialogRef = this.dialog.open(/* ProductEditDialog component */, {
        data: {
          product: this.product$.value,
          correlationId: this.correlationId
        },
        width: '80%',
        maxWidth: '1200px',
        disableClose: true
      });

      // Handle dialog result
      dialogRef.afterClosed().pipe(
        takeUntil(this.destroy$)
      ).subscribe(async result => {
        if (result) {
          // Update product with validation
          const updated = await this.marketplaceService.updateProduct(
            this.product$.value.id,
            result
          ).toPromise();

          if (updated) {
            this.product$.next(updated);
          }
        }
      });
    } catch (error) {
      console.error('Error during edit operation:', error);
    }
  }

  getFormattedSpecifications(): any[] {
    const product = this.product$.value;
    if (!product?.attributes) {
      return [];
    }

    return Object.entries(product.attributes).map(([key, value]) => ({
      attribute: key,
      value: value,
      eclassCode: product.eclassMapping?.[key] || 'N/A'
    }));
  }
}