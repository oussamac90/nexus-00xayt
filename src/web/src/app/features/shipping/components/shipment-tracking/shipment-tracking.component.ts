// @angular/core v16.x
import { 
  Component, 
  Input, 
  OnInit, 
  OnDestroy, 
  ChangeDetectionStrategy,
  ChangeDetectorRef 
} from '@angular/core';

// @angular/material/progress-bar v16.x
import { MatProgressBar } from '@angular/material/progress-bar';

// @angular/material/card v16.x
import { MatCard, MatCardModule } from '@angular/material/card';

// rxjs v7.x
import { 
  Subject, 
  Subscription, 
  interval, 
  BehaviorSubject, 
  throwError 
} from 'rxjs';
import { 
  takeUntil, 
  switchMap, 
  catchError, 
  retry, 
  debounceTime 
} from 'rxjs/operators';

// Internal imports
import { ShippingApiService } from '../../services/shipping-api.service';
import { LoaderComponent } from '../../../../shared/components/loader/loader.component';
import { ThemeService } from '../../../../core/services/theme.service';

// Constants
const TRACKING_POLL_INTERVAL = 30000; // 30 seconds
const MAX_RETRY_ATTEMPTS = 3;
const OFFLINE_CHECK_INTERVAL = 5000; // 5 seconds

// Shipment status mapping
const SHIPMENT_STATUSES = {
  PENDING: 'Pending',
  IN_TRANSIT: 'In Transit',
  OUT_FOR_DELIVERY: 'Out for Delivery',
  DELIVERED: 'Delivered',
  EXCEPTION: 'Exception',
  UNKNOWN: 'Unknown'
} as const;

interface TrackingEvent {
  status: string;
  location: string;
  timestamp: Date;
  description: string;
}

interface Location {
  city: string;
  state: string;
  country: string;
  postalCode: string;
}

@Component({
  selector: 'app-shipment-tracking',
  templateUrl: './shipment-tracking.component.html',
  styleUrls: ['./shipment-tracking.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [MatCardModule, MatProgressBar, LoaderComponent]
})
export class ShipmentTrackingComponent implements OnInit, OnDestroy {
  @Input() orderId!: string;
  @Input() trackingNumber!: string;
  @Input() carrierId!: string;

  isLoading = true;
  currentStatus: string = SHIPMENT_STATUSES.PENDING;
  estimatedDelivery: Date | null = null;
  currentLocation: Location | null = null;
  trackingHistory: TrackingEvent[] = [];
  carrierConfig: any;
  currentTheme: string = 'light';

  private destroy$ = new Subject<void>();
  private isOffline$ = new BehaviorSubject<boolean>(false);
  private trackingSubscription?: Subscription;
  private readonly retryAttempts = MAX_RETRY_ATTEMPTS;

  constructor(
    private shippingService: ShippingApiService,
    private themeService: ThemeService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // Subscribe to theme changes
    this.themeService.theme$.pipe(
      takeUntil(this.destroy$)
    ).subscribe(theme => {
      this.currentTheme = theme;
      this.cdr.markForCheck();
    });

    // Initialize tracking if inputs are valid
    if (this.validateInputs()) {
      this.initializeTracking();
      this.startTrackingUpdates();
      this.setupOfflineDetection();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.trackingSubscription) {
      this.trackingSubscription.unsubscribe();
    }
  }

  private validateInputs(): boolean {
    if (!this.orderId || !this.trackingNumber || !this.carrierId) {
      console.error('Required tracking inputs are missing');
      return false;
    }
    return true;
  }

  private initializeTracking(): void {
    this.isLoading = true;
    this.shippingService.getShipmentsByOrder(this.orderId, {
      page: 1,
      pageSize: 1
    }).pipe(
      takeUntil(this.destroy$),
      catchError(error => {
        console.error('Error initializing tracking:', error);
        return throwError(() => error);
      })
    ).subscribe(shipments => {
      if (shipments.items.length > 0) {
        const shipment = shipments.items[0];
        this.updateTrackingInfo({
          status: shipment.status,
          location: shipment.currentLocation,
          timestamp: new Date(shipment.updatedAt),
          description: ''
        });
      }
      this.isLoading = false;
      this.cdr.markForCheck();
    });
  }

  private startTrackingUpdates(): void {
    this.trackingSubscription = interval(TRACKING_POLL_INTERVAL).pipe(
      takeUntil(this.destroy$),
      switchMap(() => this.shippingService.updateTrackingStatus(
        this.trackingNumber,
        { status: this.currentStatus }
      )),
      retry({
        count: this.retryAttempts,
        delay: (error, retryCount) => interval(Math.pow(2, retryCount) * 1000)
      }),
      catchError(error => {
        this.handleTrackingError(error);
        return throwError(() => error);
      })
    ).subscribe(shipment => {
      this.updateTrackingInfo({
        status: shipment.status,
        location: shipment.currentLocation,
        timestamp: new Date(shipment.updatedAt),
        description: ''
      });
      this.cdr.markForCheck();
    });
  }

  private setupOfflineDetection(): void {
    window.addEventListener('online', () => this.handleOnlineStatus(true));
    window.addEventListener('offline', () => this.handleOnlineStatus(false));
  }

  private handleOnlineStatus(isOnline: boolean): void {
    this.isOffline$.next(!isOnline);
    if (isOnline) {
      this.initializeTracking();
    }
  }

  private handleTrackingError(error: any): void {
    console.error('Tracking error:', error);
    if (!navigator.onLine) {
      this.isOffline$.next(true);
    }
  }

  private updateTrackingInfo(event: TrackingEvent): void {
    this.currentStatus = event.status;
    if (event.location) {
      this.currentLocation = event.location as Location;
    }
    this.trackingHistory = [
      event,
      ...this.trackingHistory
    ].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // Update ARIA labels for accessibility
    this.updateAccessibilityLabels();
  }

  private updateAccessibilityLabels(): void {
    const statusElement = document.querySelector('[role="status"]');
    if (statusElement) {
      statusElement.setAttribute('aria-label', 
        `Shipment status: ${this.currentStatus}. ${
          this.currentLocation ? 
          `Current location: ${this.formatLocation(this.currentLocation)}` : 
          ''
        }`
      );
    }
  }

  private formatLocation(location: Location): string {
    return `${location.city}, ${location.state}, ${location.country}`;
  }
}