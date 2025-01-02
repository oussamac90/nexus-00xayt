// @angular/core/testing v16.x
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
// @angular/cdk/layout v16.x
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
// @angular/platform-browser/animations v16.x
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
// rxjs v7.x
import { BehaviorSubject, Subject } from 'rxjs';

import { AppComponent } from './app.component';
import { ThemeService } from './core/services/theme.service';
import { AnalyticsService } from './core/services/analytics.service';

describe('AppComponent', () => {
  let component: AppComponent;
  let fixture: ComponentFixture<AppComponent>;
  let themeServiceSpy: jasmine.SpyObj<ThemeService>;
  let breakpointObserverSpy: jasmine.SpyObj<BreakpointObserver>;
  let analyticsServiceSpy: jasmine.SpyObj<AnalyticsService>;

  // Mock observables
  const themeSubject$ = new BehaviorSubject<'light' | 'dark'>('light');
  const destroy$ = new Subject<void>();
  const breakpointMap = new Map<string, BehaviorSubject<boolean>>();

  beforeEach(async () => {
    // Initialize spies
    themeServiceSpy = jasmine.createSpyObj('ThemeService', [
      'getCurrentTheme',
      'detectSystemPreference',
      'theme$'
    ], {
      theme$: themeSubject$.asObservable()
    });

    breakpointObserverSpy = jasmine.createSpyObj('BreakpointObserver', ['observe']);
    analyticsServiceSpy = jasmine.createSpyObj('AnalyticsService', ['trackEvent', 'trackPageView']);

    // Configure breakpoint observer mock
    Object.values(Breakpoints).forEach(breakpoint => {
      breakpointMap.set(breakpoint, new BehaviorSubject(false));
    });

    breakpointObserverSpy.observe.and.callFake((queries: string[]) => {
      return breakpointMap.get(queries[0])?.asObservable() || new BehaviorSubject(false).asObservable();
    });

    await TestBed.configureTestingModule({
      declarations: [AppComponent],
      imports: [NoopAnimationsModule],
      providers: [
        { provide: ThemeService, useValue: themeServiceSpy },
        { provide: BreakpointObserver, useValue: breakpointObserverSpy },
        { provide: AnalyticsService, useValue: analyticsServiceSpy }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AppComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    destroy$.next();
    destroy$.complete();
    themeSubject$.next('light');
    breakpointMap.forEach(subject => subject.next(false));
  });

  it('should create and initialize properly', () => {
    expect(component).toBeTruthy();
    expect(themeServiceSpy.detectSystemPreference).toHaveBeenCalled();
    expect(analyticsServiceSpy.trackPageView).toHaveBeenCalledWith('app_shell', jasmine.any(Object));
  });

  describe('Layout Management', () => {
    it('should handle mobile layout (<768px)', fakeAsync(() => {
      // Simulate mobile breakpoint
      breakpointMap.get(Breakpoints.HandsetPortrait)?.next(true);
      tick(300); // Account for debounce time
      fixture.detectChanges();

      expect(component.currentViewport).toBe('mobile');
      expect(component.isNavigationOpen).toBeFalse();
      expect(analyticsServiceSpy.trackEvent).toHaveBeenCalledWith('layout_change', {
        viewport: 'mobile',
        navigationState: false
      });
    }));

    it('should handle tablet layout (768-1024px)', fakeAsync(() => {
      // Simulate tablet breakpoint
      breakpointMap.get(Breakpoints.Tablet)?.next(true);
      tick(300);
      fixture.detectChanges();

      expect(component.currentViewport).toBe('tablet');
      expect(component.isNavigationOpen).toBeTrue();
      expect(analyticsServiceSpy.trackEvent).toHaveBeenCalledWith('layout_change', {
        viewport: 'tablet',
        navigationState: true
      });
    }));

    it('should handle desktop layout (>1024px)', fakeAsync(() => {
      // Simulate desktop breakpoint
      breakpointMap.get(Breakpoints.Web)?.next(true);
      tick(300);
      fixture.detectChanges();

      expect(component.currentViewport).toBe('desktop');
      expect(component.isNavigationOpen).toBeTrue();
      expect(analyticsServiceSpy.trackEvent).toHaveBeenCalledWith('layout_change', {
        viewport: 'desktop',
        navigationState: true
      });
    }));

    it('should toggle navigation with analytics tracking', () => {
      const initialState = component.isNavigationOpen;
      component.toggleNavigation();
      fixture.detectChanges();

      expect(component.isNavigationOpen).toBe(!initialState);
      expect(analyticsServiceSpy.trackEvent).toHaveBeenCalledWith('navigation_toggle', {
        viewport: component.currentViewport,
        navigationState: component.isNavigationOpen
      });
    });
  });

  describe('Theme Management', () => {
    it('should initialize with correct theme', () => {
      expect(themeServiceSpy.getCurrentTheme).toHaveBeenCalled();
      expect(component.currentTheme).toBeDefined();
    });

    it('should handle theme changes', fakeAsync(() => {
      themeSubject$.next('dark');
      tick();
      fixture.detectChanges();

      expect(component.currentTheme).toBe('dark');
      expect(analyticsServiceSpy.trackEvent).toHaveBeenCalledWith('theme_change', {
        theme: 'dark',
        viewport: component.currentViewport
      });
    }));

    it('should detect system theme preference', () => {
      expect(themeServiceSpy.detectSystemPreference).toHaveBeenCalled();
    });
  });

  describe('Performance and Error Handling', () => {
    it('should debounce layout changes', fakeAsync(() => {
      const layoutChangeSpy = spyOn(component as any, 'handleLayoutChange');
      
      // Rapid breakpoint changes
      breakpointMap.get(Breakpoints.HandsetPortrait)?.next(true);
      breakpointMap.get(Breakpoints.HandsetPortrait)?.next(false);
      breakpointMap.get(Breakpoints.HandsetPortrait)?.next(true);
      
      tick(200); // Before debounce time
      expect(layoutChangeSpy).not.toHaveBeenCalled();
      
      tick(100); // After debounce time
      expect(layoutChangeSpy).toHaveBeenCalledTimes(1);
    }));

    it('should handle theme service errors gracefully', fakeAsync(() => {
      themeSubject$.error(new Error('Theme service error'));
      tick();
      fixture.detectChanges();

      expect(component.currentTheme).toBeDefined(); // Should maintain last valid theme
      expect(analyticsServiceSpy.trackEvent).toHaveBeenCalledWith('error', jasmine.any(Object));
    }));

    it('should cleanup subscriptions on destroy', () => {
      const unsubscribeSpy = spyOn(component['destroy$'], 'next');
      const completeSpy = spyOn(component['destroy$'], 'complete');

      component.ngOnDestroy();

      expect(unsubscribeSpy).toHaveBeenCalled();
      expect(completeSpy).toHaveBeenCalled();
    });
  });

  describe('Analytics Integration', () => {
    it('should track initial page view with correct metadata', () => {
      expect(analyticsServiceSpy.trackPageView).toHaveBeenCalledWith('app_shell', {
        path: '/',
        title: 'Nexus Platform',
        customProperties: {
          viewport: component.currentViewport,
          theme: component.currentTheme,
          navigationState: component.isNavigationOpen
        }
      });
    });

    it('should track layout changes with viewport information', fakeAsync(() => {
      breakpointMap.get(Breakpoints.HandsetPortrait)?.next(true);
      tick(300);
      fixture.detectChanges();

      expect(analyticsServiceSpy.trackEvent).toHaveBeenCalledWith('layout_change', {
        viewport: 'mobile',
        navigationState: false
      });
    }));

    it('should track theme changes with context', fakeAsync(() => {
      themeSubject$.next('dark');
      tick();
      fixture.detectChanges();

      expect(analyticsServiceSpy.trackEvent).toHaveBeenCalledWith('theme_change', {
        theme: 'dark',
        viewport: component.currentViewport
      });
    }));
  });
});