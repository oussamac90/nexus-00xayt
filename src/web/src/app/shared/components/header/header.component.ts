// @angular/core v16.x
import { 
  Component, 
  OnInit, 
  OnDestroy, 
  ChangeDetectionStrategy, 
  HostListener,
  Output,
  EventEmitter
} from '@angular/core';

// @angular/router v16.x
import { Router, NavigationEnd } from '@angular/router';

// rxjs v7.x
import { Subject } from 'rxjs';
import { takeUntil, filter, distinctUntilChanged, debounceTime } from 'rxjs/operators';

// Internal services
import { AuthService } from '../../../../core/auth/auth.service';
import { ThemeService } from '../../../../core/services/theme.service';
import { NotificationService } from '../../../../core/services/notification.service';

// Constants
const MOBILE_BREAKPOINT = 768;
const THEME_TRANSITION_DURATION = 200;

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'class': 'nexus-header',
    '[class.nexus-header--mobile]': 'isMobile',
    'role': 'banner',
    'aria-label': 'Main application header'
  }
})
export class HeaderComponent implements OnInit, OnDestroy {
  @Output() sidenavToggle = new EventEmitter<void>();

  currentUser$ = this.authService.currentUser$;
  currentTheme$ = this.themeService.theme$;
  isAuthenticated$ = this.authService.isAuthenticated$;
  isMobile = window.innerWidth < MOBILE_BREAKPOINT;

  private destroy$ = new Subject<void>();

  constructor(
    private authService: AuthService,
    private themeService: ThemeService,
    private notificationService: NotificationService,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Handle route changes
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd),
      takeUntil(this.destroy$)
    ).subscribe(() => {
      if (this.isMobile) {
        // Close mobile navigation on route change
        this.sidenavToggle.emit();
      }
    });

    // Monitor theme changes
    this.currentTheme$.pipe(
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(theme => {
      document.body.classList.remove('nexus-light-theme', 'nexus-dark-theme');
      document.body.classList.add(`nexus-${theme}-theme`);
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  @HostListener('window:resize')
  onResize(): void {
    const wasInMobileView = this.isMobile;
    this.isMobile = window.innerWidth < MOBILE_BREAKPOINT;

    // Handle view mode changes
    if (wasInMobileView !== this.isMobile) {
      // Emit sidenav toggle if switching to desktop view
      if (!this.isMobile) {
        this.sidenavToggle.emit();
      }
    }
  }

  toggleSidenav(): void {
    if (this.isMobile) {
      this.sidenavToggle.emit();
    }
  }

  handleThemeToggle(): void {
    // Add transition class
    document.body.classList.add('theme-transition');

    // Toggle theme
    this.themeService.toggleTheme();

    // Show confirmation toast
    this.notificationService.info(
      'Theme updated successfully',
      { duration: 2000 }
    );

    // Remove transition class after animation
    setTimeout(() => {
      document.body.classList.remove('theme-transition');
    }, THEME_TRANSITION_DURATION);
  }

  async handleLogout(): Promise<void> {
    try {
      await this.authService.logout();
      this.notificationService.success('Logged out successfully');
      await this.router.navigate(['/login']);
    } catch (error) {
      this.notificationService.error(
        'Error logging out. Please try again.',
        { duration: 5000 }
      );
      console.error('Logout error:', error);
    }
  }

  handleProfileClick(): void {
    this.router.navigate(['/profile']);
  }

  handleSettingsClick(): void {
    this.router.navigate(['/settings']);
  }

  handleSearchSubmit(searchTerm: string): void {
    if (searchTerm.trim()) {
      this.router.navigate(['/search'], {
        queryParams: { q: searchTerm.trim() }
      });
    }
  }

  getHeaderClass(): string {
    const classes = ['nexus-header'];
    if (this.isMobile) {
      classes.push('nexus-header--mobile');
    }
    return classes.join(' ');
  }

  getLogoAltText(): string {
    return 'Nexus Platform Logo';
  }
}