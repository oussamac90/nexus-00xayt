import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { Router, ActivatedRoute, NavigationEnd } from '@angular/router';
import { Subject, Subscription, BehaviorSubject, Observable } from 'rxjs';
import { filter, takeUntil, catchError, retry } from 'rxjs/operators';
import { ThemeService } from '../../../core/services/theme.service';
import { AnalyticsService } from '../../../core/services/analytics.service';

// Constants for configuration
const SEPARATOR_ICON = 'chevron_right';
const MAX_BREADCRUMB_LENGTH = 35;
const RETRY_ATTEMPTS = 3;

// Interface for breadcrumb items
interface BreadcrumbItem {
  label: string;
  url: string;
  icon?: string;
  isActive: boolean;
  isClickable: boolean;
  ariaLabel?: string;
  customData?: Record<string, unknown>;
}

@Component({
  selector: 'app-breadcrumb',
  templateUrl: './breadcrumb.component.html',
  styleUrls: ['./breadcrumb.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BreadcrumbComponent implements OnInit, OnDestroy {
  // Public properties
  breadcrumbs: BreadcrumbItem[] = [];
  separatorIcon = SEPARATOR_ICON;
  currentTheme$: Observable<string>;
  isError$: BehaviorSubject<boolean>;

  // Private properties
  private destroy$ = new Subject<void>();
  private routeSubscription: Subscription;
  private loading$ = new BehaviorSubject<boolean>(false);

  constructor(
    private router: Router,
    private activatedRoute: ActivatedRoute,
    private themeService: ThemeService,
    private analyticsService: AnalyticsService,
    private cdr: ChangeDetectorRef
  ) {
    this.currentTheme$ = this.themeService.theme$;
    this.isError$ = new BehaviorSubject<boolean>(false);
    this.routeSubscription = new Subscription();
  }

  ngOnInit(): void {
    // Subscribe to router events for breadcrumb updates
    this.routeSubscription = this.router.events.pipe(
      filter(event => event instanceof NavigationEnd),
      takeUntil(this.destroy$),
      retry(RETRY_ATTEMPTS),
      catchError(error => {
        this.handleError(error);
        return [];
      })
    ).subscribe(() => {
      this.loading$.next(true);
      try {
        this.breadcrumbs = this.buildBreadcrumbs(this.activatedRoute.root, [], 0);
        this.trackNavigation();
        this.isError$.next(false);
      } catch (error) {
        this.handleError(error);
      } finally {
        this.loading$.next(false);
        this.cdr.detectChanges();
      }
    });

    // Initialize keyboard navigation
    this.initializeKeyboardNavigation();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.routeSubscription) {
      this.routeSubscription.unsubscribe();
    }
  }

  /**
   * Builds the breadcrumb trail from the current route
   */
  private buildBreadcrumbs(
    route: ActivatedRoute,
    url: string[] = [],
    depth: number = 0
  ): BreadcrumbItem[] {
    const breadcrumbs: BreadcrumbItem[] = [];
    const MAX_DEPTH = 10; // Prevent infinite recursion

    if (depth > MAX_DEPTH) {
      console.warn('Maximum breadcrumb depth reached');
      return breadcrumbs;
    }

    // Extract route data and parameters
    const routeData = route.snapshot.data;
    const routeParams = route.snapshot.params;
    const routePath = route.snapshot.url.map(segment => segment.path);

    // Build current URL segment
    const currentUrl = [...url, ...routePath];

    // Add breadcrumb if route data contains necessary information
    if (routeData['breadcrumb']) {
      let label = typeof routeData['breadcrumb'] === 'function'
        ? routeData['breadcrumb'](routeParams)
        : routeData['breadcrumb'];

      // Truncate long labels
      if (label.length > MAX_BREADCRUMB_LENGTH) {
        label = `${label.substring(0, MAX_BREADCRUMB_LENGTH)}...`;
      }

      const breadcrumbItem: BreadcrumbItem = {
        label,
        url: '/' + currentUrl.join('/'),
        icon: routeData['icon'],
        isActive: false,
        isClickable: true,
        ariaLabel: `Navigate to ${label}`,
        customData: routeData['breadcrumbData']
      };

      breadcrumbs.push(breadcrumbItem);
    }

    // Process child routes
    if (route.firstChild) {
      breadcrumbs.push(...this.buildBreadcrumbs(route.firstChild, currentUrl, depth + 1));
    }

    // Mark last item as active and non-clickable
    if (breadcrumbs.length > 0) {
      const lastItem = breadcrumbs[breadcrumbs.length - 1];
      lastItem.isActive = true;
      lastItem.isClickable = false;
      lastItem.ariaLabel = `Current page: ${lastItem.label}`;
    }

    return breadcrumbs;
  }

  /**
   * Handles navigation to a breadcrumb item
   */
  navigateTo(item: BreadcrumbItem): void {
    if (!item.isClickable) return;

    this.loading$.next(true);
    try {
      this.router.navigate([item.url]).then(() => {
        this.analyticsService.trackEvent('breadcrumb_navigation', {
          from: this.router.url,
          to: item.url,
          label: item.label
        });
      }).catch(error => {
        this.handleError(error);
      }).finally(() => {
        this.loading$.next(false);
        this.cdr.detectChanges();
      });
    } catch (error) {
      this.handleError(error);
      this.loading$.next(false);
    }
  }

  /**
   * Initializes keyboard navigation for accessibility
   */
  private initializeKeyboardNavigation(): void {
    const handleKeyPress = (event: KeyboardEvent, item: BreadcrumbItem) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        this.navigateTo(item);
      }
    };

    // Add event listeners for keyboard navigation
    document.querySelectorAll('.breadcrumb-item').forEach((element, index) => {
      element.addEventListener('keydown', (event) => {
        handleKeyPress(event as KeyboardEvent, this.breadcrumbs[index]);
      });
    });
  }

  /**
   * Tracks navigation events in analytics
   */
  private trackNavigation(): void {
    if (this.breadcrumbs.length > 0) {
      const currentPath = this.breadcrumbs.map(item => item.label).join(' > ');
      this.analyticsService.trackPageView('breadcrumb_update', {
        path: currentPath,
        title: document.title,
        customProperties: {
          breadcrumbDepth: this.breadcrumbs.length,
          currentRoute: this.router.url
        }
      });
    }
  }

  /**
   * Handles errors in breadcrumb operations
   */
  private handleError(error: Error): void {
    this.isError$.next(true);
    this.analyticsService.trackError(error, {
      component: 'BreadcrumbComponent',
      action: 'breadcrumb_operation',
      customProperties: {
        currentUrl: this.router.url,
        breadcrumbCount: this.breadcrumbs.length
      }
    });
    console.error('Breadcrumb error:', error);
  }

  /**
   * Gets loading state as observable
   */
  get isLoading$(): Observable<boolean> {
    return this.loading$.asObservable();
  }
}