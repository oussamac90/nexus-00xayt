// @angular/core v16.x
import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';

// rxjs v7.x
import { Subscription, Observable, Subject, BehaviorSubject } from 'rxjs';
import { filter, takeUntil, distinctUntilChanged } from 'rxjs/operators';

// @angular/material v16.x
import { MatSidenav } from '@angular/material/sidenav';

// Internal imports
import { AuthService } from '../../../core/auth/auth.service';
import { ThemeService } from '../../../core/services/theme.service';

// Navigation menu items with role-based access
const SIDEBAR_MENU_ITEMS = [
  { path: '/dashboard', icon: 'dashboard', label: 'Dashboard', roles: ['*'], ariaLabel: 'Navigate to Dashboard' },
  { path: '/marketplace', icon: 'store', label: 'Marketplace', roles: ['buyer', 'vendor'], ariaLabel: 'Navigate to Marketplace' },
  { path: '/orders', icon: 'list_alt', label: 'Orders', roles: ['buyer', 'vendor'], ariaLabel: 'Navigate to Orders' },
  { path: '/shipping', icon: 'local_shipping', label: 'Shipping', roles: ['buyer', 'vendor', 'logistics'], ariaLabel: 'Navigate to Shipping' },
  { path: '/analytics', icon: 'insights', label: 'Analytics', roles: ['admin'], ariaLabel: 'Navigate to Analytics' }
];

@Component({
  selector: 'app-sidebar',
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SidebarComponent implements OnInit, OnDestroy {
  // Observables
  isAuthenticated$: Observable<boolean>;
  currentTheme$: Observable<string>;
  currentRoute$ = new BehaviorSubject<string>('');
  isExpanded$ = new BehaviorSubject<boolean>(true);
  
  // Component state
  menuItems = SIDEBAR_MENU_ITEMS;
  isMobile = false;
  isTablet = false;
  
  // Private members
  private destroy$ = new Subject<void>();
  private roleCache = new Map<string, boolean>();
  private mediaQueryList: MediaQueryList[] = [];
  
  constructor(
    private router: Router,
    private authService: AuthService,
    private themeService: ThemeService,
    private cdr: ChangeDetectorRef
  ) {
    this.isAuthenticated$ = this.authService.isAuthenticated$;
    this.currentTheme$ = this.themeService.theme$;
    this.initializeResponsiveBreakpoints();
  }

  ngOnInit(): void {
    // Track route changes
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd),
      takeUntil(this.destroy$)
    ).subscribe((event: NavigationEnd) => {
      this.currentRoute$.next(event.urlAfterRedirects);
      this.handleResponsiveNavigation();
      this.cdr.markForCheck();
    });

    // Set up responsive listeners
    this.setupResponsiveListeners();
  }

  ngOnDestroy(): void {
    // Clean up subscriptions and listeners
    this.destroy$.next();
    this.destroy$.complete();
    this.roleCache.clear();
    this.cleanupMediaQueries();
  }

  /**
   * Toggles sidebar expansion state with animation
   */
  toggleSidebar(): void {
    const newState = !this.isExpanded$.value;
    this.isExpanded$.next(newState);
    
    // Announce state change for screen readers
    const message = newState ? 'Sidebar expanded' : 'Sidebar collapsed';
    this.announceForAccessibility(message);
    
    this.cdr.markForCheck();
  }

  /**
   * Toggles theme with system preference detection
   */
  toggleTheme(): void {
    this.themeService.toggleTheme();
  }

  /**
   * Checks if the given route is currently active
   */
  isRouteActive(path: string): boolean {
    return this.currentRoute$.value.startsWith(path);
  }

  /**
   * Validates if user has required role for menu item
   */
  hasRequiredRole(roles: string[]): boolean {
    // Check cache first
    const cacheKey = roles.join(',');
    if (this.roleCache.has(cacheKey)) {
      return this.roleCache.get(cacheKey)!;
    }

    // Handle wildcard access
    if (roles.includes('*')) {
      this.roleCache.set(cacheKey, true);
      return true;
    }

    // Validate user roles
    const hasRole = roles.some(role => this.authService.hasRole(role));
    this.roleCache.set(cacheKey, hasRole);
    return hasRole;
  }

  /**
   * Handles keyboard navigation
   */
  handleKeyboardNavigation(event: KeyboardEvent, path: string): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.router.navigate([path]);
    }
  }

  private initializeResponsiveBreakpoints(): void {
    this.mediaQueryList = [
      window.matchMedia('(max-width: 767px)'),
      window.matchMedia('(min-width: 768px) and (max-width: 1023px)')
    ];
  }

  private setupResponsiveListeners(): void {
    // Mobile breakpoint
    this.mediaQueryList[0].addEventListener('change', (e: MediaQueryListEvent) => {
      this.isMobile = e.matches;
      this.handleResponsiveNavigation();
      this.cdr.markForCheck();
    });

    // Tablet breakpoint
    this.mediaQueryList[1].addEventListener('change', (e: MediaQueryListEvent) => {
      this.isTablet = e.matches;
      this.handleResponsiveNavigation();
      this.cdr.markForCheck();
    });

    // Set initial states
    this.isMobile = this.mediaQueryList[0].matches;
    this.isTablet = this.mediaQueryList[1].matches;
    this.handleResponsiveNavigation();
  }

  private handleResponsiveNavigation(): void {
    if (this.isMobile) {
      this.isExpanded$.next(false);
    } else if (this.isTablet) {
      this.isExpanded$.next(false);
    } else {
      this.isExpanded$.next(true);
    }
  }

  private cleanupMediaQueries(): void {
    this.mediaQueryList.forEach(query => {
      query.removeEventListener('change', () => {});
    });
  }

  private announceForAccessibility(message: string): void {
    const announcer = document.createElement('div');
    announcer.setAttribute('aria-live', 'polite');
    announcer.setAttribute('class', 'cdk-visually-hidden');
    announcer.textContent = message;
    document.body.appendChild(announcer);
    
    setTimeout(() => {
      document.body.removeChild(announcer);
    }, 100);
  }
}