// Angular Core v16.x
import {
  Component,
  OnInit,
  OnDestroy,
  ViewChild,
  ChangeDetectionStrategy,
  ChangeDetectorRef
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

// RxJS v7.x
import { Subject, takeUntil, catchError, retry, finalize } from 'rxjs';

// Angular Material v16.x
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTabGroup } from '@angular/material/tabs';
import { ErrorStateMatcher } from '@angular/material/core';

// Internal Imports
import { ShippingApiService } from './services/shipping-api.service';
import { ShippingRatesComponent } from './components/shipping-rates/shipping-rates.component';
import { ShipmentTrackingComponent } from './components/shipment-tracking/shipment-tracking.component';

// Constants
const TAB_INDICES = {
  RATES: 0,
  TRACKING: 1,
  DOCUMENTS: 2
} as const;

const MAX_RETRY_ATTEMPTS = 3;

const ARIA_LABELS = {
  SHIPPING_CONTAINER: 'Shipping management container',
  RATES_TAB: 'Shipping rates selection',
  TRACKING_TAB: 'Shipment tracking information',
  DOCUMENTS_TAB: 'Shipping documents'
};

@Component({
  selector: 'app-shipping',
  templateUrl: './shipping.component.html',
  styleUrls: ['./shipping.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'role': 'main',
    'aria-label': ARIA_LABELS.SHIPPING_CONTAINER
  }
})
export class ShippingComponent implements OnInit, OnDestroy {
  // ViewChild References
  @ViewChild(ShippingRatesComponent) ratesComponent!: ShippingRatesComponent;
  @ViewChild(ShipmentTrackingComponent) trackingComponent!: ShipmentTrackingComponent;
  @ViewChild(MatTabGroup) tabGroup!: MatTabGroup;

  // Public Properties
  currentOrderId: string = '';
  selectedTrackingNumber: string = '';
  isLoading: boolean = false;
  retryAttempts: Map<string, number> = new Map();
  errorMatcher: ErrorStateMatcher = new ErrorStateMatcher();
  isOffline: boolean = false;

  // Private Properties
  private destroy$ = new Subject<void>();

  constructor(
    private shippingService: ShippingApiService,
    private route: ActivatedRoute,
    private router: Router,
    private snackBar: MatSnackBar,
    private cdr: ChangeDetectorRef
  ) {
    this.setupOfflineDetection();
  }

  ngOnInit(): void {
    this.initializeShippingComponent();
    this.setupRouteSubscription();
    this.setupAccessibility();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.cleanupResources();
  }

  private initializeShippingComponent(): void {
    this.isLoading = true;
    this.cdr.markForCheck();
  }

  private setupRouteSubscription(): void {
    this.route.params.pipe(
      takeUntil(this.destroy$)
    ).subscribe(params => {
      if (params['orderId']) {
        this.currentOrderId = params['orderId'];
        this.loadShipmentData();
      }
    });
  }

  private setupAccessibility(): void {
    if (this.tabGroup) {
      this.tabGroup._elementRef.nativeElement.setAttribute('aria-label', 'Shipping operations');
      this.setupKeyboardNavigation();
    }
  }

  private setupKeyboardNavigation(): void {
    document.addEventListener('keydown', (event: KeyboardEvent) => {
      if (event.altKey) {
        switch (event.key) {
          case '1':
            this.switchTab(TAB_INDICES.RATES);
            break;
          case '2':
            this.switchTab(TAB_INDICES.TRACKING);
            break;
          case '3':
            this.switchTab(TAB_INDICES.DOCUMENTS);
            break;
        }
      }
    });
  }

  private setupOfflineDetection(): void {
    window.addEventListener('online', () => {
      this.isOffline = false;
      this.loadShipmentData();
      this.cdr.markForCheck();
    });

    window.addEventListener('offline', () => {
      this.isOffline = true;
      this.cdr.markForCheck();
    });
  }

  private async loadShipmentData(): Promise<void> {
    if (!this.currentOrderId || this.isOffline) return;

    this.isLoading = true;
    this.cdr.markForCheck();

    try {
      const shipments = await this.shippingService.getShipmentsByOrder(
        this.currentOrderId,
        { page: 1, pageSize: 1 }
      ).pipe(
        retry({
          count: MAX_RETRY_ATTEMPTS,
          delay: (error, retryCount) => retryCount * 1000
        }),
        catchError(error => {
          this.handleError('Error loading shipment data', error);
          throw error;
        }),
        finalize(() => {
          this.isLoading = false;
          this.cdr.markForCheck();
        })
      ).toPromise();

      if (shipments?.items.length > 0) {
        this.selectedTrackingNumber = shipments.items[0].trackingNumber;
        this.switchTab(TAB_INDICES.TRACKING);
      }
    } catch (error) {
      this.isLoading = false;
      this.cdr.markForCheck();
    }
  }

  async onRateSelected(rate: any): Promise<void> {
    try {
      this.isLoading = true;
      this.cdr.markForCheck();

      const shipment = await this.shippingService.createShipment(
        this.currentOrderId,
        {
          carrier: rate.carrier,
          service: rate.service,
          rate: rate.rate,
          recipientAddress: rate.address,
          dimensions: rate.dimensions,
          weight: rate.weight
        }
      ).pipe(
        retry({
          count: MAX_RETRY_ATTEMPTS,
          delay: (error, retryCount) => retryCount * 1000
        }),
        catchError(error => {
          this.handleError('Error creating shipment', error);
          throw error;
        })
      ).toPromise();

      if (shipment) {
        this.selectedTrackingNumber = shipment.trackingNumber;
        this.switchTab(TAB_INDICES.TRACKING);
        this.showSuccessMessage('Shipment created successfully');
      }
    } catch (error) {
      // Error already handled in catchError
    } finally {
      this.isLoading = false;
      this.cdr.markForCheck();
    }
  }

  async generateLabel(): Promise<void> {
    if (!this.selectedTrackingNumber) return;

    try {
      this.isLoading = true;
      this.cdr.markForCheck();

      const label = await this.shippingService.generateShippingLabel(
        this.selectedTrackingNumber,
        'pdf'
      ).pipe(
        retry({
          count: MAX_RETRY_ATTEMPTS,
          delay: (error, retryCount) => retryCount * 1000
        }),
        catchError(error => {
          this.handleError('Error generating shipping label', error);
          throw error;
        })
      ).toPromise();

      if (label) {
        const url = window.URL.createObjectURL(label);
        const link = document.createElement('a');
        link.href = url;
        link.download = `shipping-label-${this.selectedTrackingNumber}.pdf`;
        link.click();
        window.URL.revokeObjectURL(url);
        this.showSuccessMessage('Shipping label generated successfully');
      }
    } catch (error) {
      // Error already handled in catchError
    } finally {
      this.isLoading = false;
      this.cdr.markForCheck();
    }
  }

  switchTab(index: number): void {
    if (this.tabGroup && !this.isLoading) {
      this.tabGroup.selectedIndex = index;
      this.updateUrlWithTab(index);
      this.announceTabChange(index);
      this.cdr.markForCheck();
    }
  }

  private updateUrlWithTab(index: number): void {
    const tabMap = {
      [TAB_INDICES.RATES]: 'rates',
      [TAB_INDICES.TRACKING]: 'tracking',
      [TAB_INDICES.DOCUMENTS]: 'documents'
    };

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: tabMap[index] },
      queryParamsHandling: 'merge'
    });
  }

  private announceTabChange(index: number): void {
    const tabLabels = {
      [TAB_INDICES.RATES]: ARIA_LABELS.RATES_TAB,
      [TAB_INDICES.TRACKING]: ARIA_LABELS.TRACKING_TAB,
      [TAB_INDICES.DOCUMENTS]: ARIA_LABELS.DOCUMENTS_TAB
    };

    const announcement = document.createElement('div');
    announcement.setAttribute('aria-live', 'polite');
    announcement.textContent = `Switched to ${tabLabels[index]}`;
    document.body.appendChild(announcement);
    setTimeout(() => announcement.remove(), 1000);
  }

  private handleError(message: string, error: any): void {
    console.error(message, error);
    this.snackBar.open(
      `${message}. Please try again later.`,
      'Close',
      {
        duration: 5000,
        panelClass: ['error-snackbar'],
        horizontalPosition: 'right'
      }
    );
  }

  private showSuccessMessage(message: string): void {
    this.snackBar.open(
      message,
      'Close',
      {
        duration: 3000,
        horizontalPosition: 'right'
      }
    );
  }

  private cleanupResources(): void {
    this.retryAttempts.clear();
    document.removeEventListener('keydown', () => {});
    window.removeEventListener('online', () => {});
    window.removeEventListener('offline', () => {});
  }
}