// @angular/core v16.x
import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
// @angular/cdk/layout v16.x
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
// rxjs v7.x
import { Subject, takeUntil, distinctUntilChanged, debounceTime } from 'rxjs';

import { ThemeService } from './core/services/theme.service';
import { AnalyticsService } from './core/services/analytics.service';

// Constants for layout management
const BREAKPOINTS = {
  MOBILE: 768,
  TABLET: 1024,
  DESKTOP: 1440
} as const;

// Constants for analytics tracking
const ANALYTICS_EVENTS = {
  LAYOUT_CHANGE: 'layout_change',
  THEME_CHANGE: 'theme_change',
  NAVIGATION_TOGGLE: 'navigation_toggle'
} as const;

// Constants for theme management
const THEME_TRANSITION_DURATION = 300;

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppComponent implements OnInit, OnDestroy {
  // Layout state
  currentViewport: 'mobile' | 'tablet' | 'desktop' = 'desktop';
  isNavigationOpen = true;

  // Theme state
  currentTheme: 'light' | 'dark';

  // Cleanup subject
  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly breakpointObserver: BreakpointObserver,
    private readonly themeService: ThemeService,
    private readonly analyticsService: AnalyticsService,
    private readonly cdr: ChangeDetectorRef
  ) {
    // Initialize theme from service
    this.currentTheme = this.themeService.getCurrentTheme();
  }

  ngOnInit(): void {
    // Initialize responsive layout monitoring
    this.initializeLayoutObserver();

    // Initialize theme monitoring
    this.initializeThemeObserver();

    // Track initial page view
    this.trackInitialPageView();

    // Initialize system theme preference detection
    this.themeService.detectSystemPreference();
  }

  ngOnDestroy(): void {
    // Clean up subscriptions
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Handles layout changes based on viewport size
   */
  handleLayoutChange(state: { matches: boolean, breakpoint: string }): void {
    let newViewport: 'mobile' | 'tablet' | 'desktop';

    // Determine viewport based on breakpoint
    if (state.matches) {
      if (state.breakpoint.includes('HandsetPortrait')) {
        newViewport = 'mobile';
        this.isNavigationOpen = false;
      } else if (state.breakpoint.includes('Tablet')) {
        newViewport = 'tablet';
        this.isNavigationOpen = true;
      } else {
        newViewport = 'desktop';
        this.isNavigationOpen = true;
      }

      // Only update if viewport changed
      if (this.currentViewport !== newViewport) {
        this.currentViewport = newViewport;
        
        // Track layout change
        this.analyticsService.trackEvent(ANALYTICS_EVENTS.LAYOUT_CHANGE, {
          viewport: newViewport,
          navigationState: this.isNavigationOpen
        });

        // Trigger change detection
        this.cdr.markForCheck();
      }
    }
  }

  /**
   * Toggles navigation sidebar with analytics tracking
   */
  toggleNavigation(): void {
    this.isNavigationOpen = !this.isNavigationOpen;
    
    this.analyticsService.trackEvent(ANALYTICS_EVENTS.NAVIGATION_TOGGLE, {
      viewport: this.currentViewport,
      navigationState: this.isNavigationOpen
    });

    this.cdr.markForCheck();
  }

  /**
   * Initializes responsive layout monitoring
   */
  private initializeLayoutObserver(): void {
    const queries = {
      mobile: Breakpoints.HandsetPortrait,
      tablet: Breakpoints.Tablet,
      desktop: Breakpoints.Web
    };

    Object.entries(queries).forEach(([breakpoint, query]) => {
      this.breakpointObserver
        .observe([query])
        .pipe(
          takeUntil(this.destroy$),
          distinctUntilChanged(),
          debounceTime(THEME_TRANSITION_DURATION)
        )
        .subscribe(state => this.handleLayoutChange({ ...state, breakpoint }));
    });
  }

  /**
   * Initializes theme monitoring
   */
  private initializeThemeObserver(): void {
    this.themeService.theme$
      .pipe(
        takeUntil(this.destroy$),
        distinctUntilChanged()
      )
      .subscribe(theme => {
        this.currentTheme = theme;
        
        this.analyticsService.trackEvent(ANALYTICS_EVENTS.THEME_CHANGE, {
          theme,
          viewport: this.currentViewport
        });

        this.cdr.markForCheck();
      });
  }

  /**
   * Tracks initial page view with performance metrics
   */
  private trackInitialPageView(): void {
    this.analyticsService.trackPageView('app_shell', {
      path: '/',
      title: 'Nexus Platform',
      customProperties: {
        viewport: this.currentViewport,
        theme: this.currentTheme,
        navigationState: this.isNavigationOpen
      }
    });
  }
}