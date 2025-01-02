// @angular/core v16.x
import { Component, OnInit, OnDestroy, ChangeDetectorRef, HostListener } from '@angular/core';
// @angular/router v16.x
import { Router, NavigationEnd } from '@angular/router';
// @ngrx/store v16.x
import { Store } from '@ngrx/store';
// rxjs v7.x
import { Observable, Subject, fromEvent } from 'rxjs';
import { filter, takeUntil, debounceTime, distinctUntilChanged } from 'rxjs/operators';

import { AuthService } from '../../../core/auth/auth.service';
import { ThemeService, ThemeType } from '../../../core/services/theme.service';
import { AppState } from '../../../core/store/state';

// Navigation item interface for type safety
interface NavigationItem {
  path: string;
  icon: string;
  label: string;
  roles: string[];
  ariaLabel: string;
  analyticsTag: string;
}

// Navigation items with role-based access control
const NAVIGATION_ITEMS: NavigationItem[] = [
  {
    path: '/dashboard',
    icon: 'dashboard',
    label: 'Dashboard',
    roles: ['*'],
    ariaLabel: 'Navigate to Dashboard',
    analyticsTag: 'nav_dashboard'
  },
  {
    path: '/marketplace',
    icon: 'store',
    label: 'Marketplace',
    roles: ['buyer', 'vendor'],
    ariaLabel: 'Navigate to Marketplace',
    analyticsTag: 'nav_marketplace'
  },
  {
    path: '/orders',
    icon: 'list_alt',
    label: 'Orders',
    roles: ['buyer', 'vendor'],
    ariaLabel: 'Navigate to Orders',
    analyticsTag: 'nav_orders'
  },
  {
    path: '/shipping',
    icon: 'local_shipping',
    label: 'Shipping',
    roles: ['buyer', 'vendor', 'logistics'],
    ariaLabel: 'Navigate to Shipping',
    analyticsTag: 'nav_shipping'
  },
  {
    path: '/analytics',
    icon: 'insights',
    label: 'Analytics',
    roles: ['admin'],
    ariaLabel: 'Navigate to Analytics',
    analyticsTag: 'nav_analytics'
  }
];

@Component({
  selector: 'app-navigation',
  templateUrl: './navigation.component.html',
  styleUrls: [
    './navigation.component.scss',
    './navigation.component.mobile.scss',
    './navigation.component.tablet.scss',
    './navigation.component.desktop.scss'
  ]
})
export class NavigationComponent implements OnInit, OnDestroy {
  // Observables
  isAuthenticated$: Observable<boolean>;
  currentTheme$: Observable<ThemeType>;

  // Component state
  currentRoute: string = '';
  isMobileMenuOpen: boolean = false;
  isTabletView: boolean = false;
  isDesktopView: boolean = false;
  navigationItems = NAVIGATION_ITEMS;

  // Responsive breakpoints from variables.scss
  private readonly TABLET_BREAKPOINT = 768;
  private readonly DESKTOP_BREAKPOINT = 1024;
  
  // RxJS cleanup
  private destroy$ = new Subject<void>();

  constructor(
    private router: Router,
    private store: Store<AppState>,
    private authService: AuthService,
    private themeService: ThemeService,
    private changeDetector: ChangeDetectorRef
  ) {
    this.isAuthenticated$ = this.authService.isAuthenticated$;
    this.currentTheme$ = this.themeService.theme$;
  }

  ngOnInit(): void {
    // Handle route changes
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd),
      takeUntil(this.destroy$)
    ).subscribe((event: NavigationEnd) => {
      this.currentRoute = event.urlAfterRedirects;
      this.isMobileMenuOpen = false;
      this.changeDetector.detectChanges();
    });

    // Handle window resize for responsive behavior
    fromEvent(window, 'resize').pipe(
      debounceTime(250),
      takeUntil(this.destroy$)
    ).subscribe(() => {
      this.checkViewport();
    });

    // Initial viewport check
    this.checkViewport();

    // Set up keyboard navigation
    this.setupKeyboardNavigation();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Toggles mobile navigation menu
   */
  toggleMobileMenu(): void {
    this.isMobileMenuOpen = !this.isMobileMenuOpen;
    
    // Update ARIA attributes
    const menuElement = document.querySelector('.navigation-menu');
    if (menuElement) {
      menuElement.setAttribute('aria-expanded', this.isMobileMenuOpen.toString());
    }

    // Prevent body scroll when menu is open
    document.body.style.overflow = this.isMobileMenuOpen ? 'hidden' : '';
  }

  /**
   * Toggles theme with system preference detection
   */
  toggleTheme(): void {
    this.themeService.toggleTheme();
  }

  /**
   * Checks if a route is currently active
   */
  isRouteActive(path: string): boolean {
    return this.currentRoute.startsWith(path);
  }

  /**
   * Checks if user has required role for menu item
   */
  hasRequiredRole(roles: string[]): boolean {
    if (roles.includes('*')) return true;
    
    const userRoles = this.authService.getCurrentUser()?.roles || [];
    return roles.some(role => userRoles.includes(role));
  }

  /**
   * Handles keyboard navigation
   */
  @HostListener('keydown', ['$event'])
  handleKeyboardNavigation(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.isMobileMenuOpen) {
      this.toggleMobileMenu();
    }
  }

  /**
   * Checks viewport size and updates responsive state
   */
  private checkViewport(): void {
    const width = window.innerWidth;
    this.isTabletView = width >= this.TABLET_BREAKPOINT && width < this.DESKTOP_BREAKPOINT;
    this.isDesktopView = width >= this.DESKTOP_BREAKPOINT;
    
    // Close mobile menu if viewport becomes larger
    if (this.isTabletView || this.isDesktopView) {
      this.isMobileMenuOpen = false;
    }
    
    this.changeDetector.detectChanges();
  }

  /**
   * Sets up keyboard navigation handlers
   */
  private setupKeyboardNavigation(): void {
    const navigationItems = document.querySelectorAll('.nav-item');
    navigationItems.forEach((item, index) => {
      item.setAttribute('tabindex', '0');
      item.addEventListener('keydown', (event: KeyboardEvent) => {
        switch (event.key) {
          case 'ArrowDown':
            event.preventDefault();
            (navigationItems[Math.min(index + 1, navigationItems.length - 1)] as HTMLElement).focus();
            break;
          case 'ArrowUp':
            event.preventDefault();
            (navigationItems[Math.max(index - 1, 0)] as HTMLElement).focus();
            break;
          case 'Enter':
          case ' ':
            event.preventDefault();
            (item as HTMLElement).click();
            break;
        }
      });
    });
  }
}