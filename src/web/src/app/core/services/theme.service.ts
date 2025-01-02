import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { distinctUntilChanged } from 'rxjs/operators';

// Theme type definition for type safety
export type ThemeType = 'light' | 'dark';

// Constants
const THEME_STORAGE_KEY = 'nexus-theme-preference';
const DEFAULT_THEME: ThemeType = 'light';
const VALID_THEMES = ['light', 'dark'] as const;
const SYSTEM_DARK_THEME_QUERY = '(prefers-color-scheme: dark)';
const THEME_TRANSITION_DURATION = 200; // matches $animation-duration-base from _variables.scss

@Injectable({
  providedIn: 'root'
})
export class ThemeService implements OnDestroy {
  private currentTheme$ = new BehaviorSubject<ThemeType>(DEFAULT_THEME);
  private systemThemeQuery: MediaQueryList;
  private transitionTimeout?: number;

  // Public observable for theme changes
  readonly theme$: Observable<ThemeType> = this.currentTheme$.pipe(
    distinctUntilChanged()
  );

  constructor() {
    // Initialize system theme detection
    this.systemThemeQuery = window.matchMedia(SYSTEM_DARK_THEME_QUERY);
    
    // Set up system theme change listener
    this.handleSystemThemeChange = this.handleSystemThemeChange.bind(this);
    this.systemThemeQuery.addEventListener('change', this.handleSystemThemeChange);

    // Initialize theme from storage or system preference
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY) as ThemeType | null;
    const initialTheme = savedTheme || (this.detectSystemTheme());
    
    // Apply initial theme
    this.setTheme(initialTheme);

    // Set initial meta theme-color
    this.updateMetaThemeColor(initialTheme);
  }

  ngOnDestroy(): void {
    // Clean up listeners and subscriptions
    this.systemThemeQuery.removeEventListener('change', this.handleSystemThemeChange);
    this.currentTheme$.complete();
    
    if (this.transitionTimeout) {
      window.clearTimeout(this.transitionTimeout);
    }
  }

  /**
   * Gets the current active theme
   */
  getCurrentTheme(): ThemeType {
    return this.currentTheme$.value;
  }

  /**
   * Sets the active theme with validation
   */
  setTheme(themeName: ThemeType): void {
    // Validate theme name
    if (!VALID_THEMES.includes(themeName)) {
      console.error(`Invalid theme: ${themeName}. Must be one of: ${VALID_THEMES.join(', ')}`);
      return;
    }

    // Remove all theme classes
    document.body.classList.remove('nexus-light-theme', 'nexus-dark-theme');
    
    // Add new theme class
    document.body.classList.add(`nexus-${themeName}-theme`);
    
    // Store preference
    localStorage.setItem(THEME_STORAGE_KEY, themeName);
    
    // Update theme subject
    this.currentTheme$.next(themeName);
    
    // Update meta theme-color
    this.updateMetaThemeColor(themeName);
  }

  /**
   * Toggles between light and dark themes with transition
   */
  toggleTheme(): void {
    const currentTheme = this.getCurrentTheme();
    const newTheme: ThemeType = currentTheme === 'light' ? 'dark' : 'light';

    // Add transition class for smooth theme change
    document.body.classList.add('theme-transition');
    
    // Set new theme
    this.setTheme(newTheme);
    
    // Remove transition class after animation completes
    this.transitionTimeout = window.setTimeout(() => {
      document.body.classList.remove('theme-transition');
    }, THEME_TRANSITION_DURATION);
  }

  /**
   * Detects system theme preference
   */
  private detectSystemTheme(): ThemeType {
    return this.systemThemeQuery.matches ? 'dark' : 'light';
  }

  /**
   * Handles system theme preference changes
   */
  private handleSystemThemeChange(e: MediaQueryListEvent): void {
    const systemTheme: ThemeType = e.matches ? 'dark' : 'light';
    
    // Only update if no user preference is stored
    if (!localStorage.getItem(THEME_STORAGE_KEY)) {
      this.setTheme(systemTheme);
    }
  }

  /**
   * Updates meta theme-color for mobile browsers
   */
  private updateMetaThemeColor(theme: ThemeType): void {
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute(
        'content',
        theme === 'dark' ? '#303030' : '#FFFFFF'
      );
    }
  }
}