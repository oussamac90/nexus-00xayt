// @angular/core v16.x
import { 
  Component, 
  Input, 
  Output, 
  EventEmitter, 
  OnInit, 
  OnDestroy, 
  ChangeDetectionStrategy, 
  HostBinding, 
  ElementRef,
  ChangeDetectorRef
} from '@angular/core';

// @angular/material v16.x
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { NgClass, NgIf } from '@angular/common';

// rxjs v7.x
import { Subject, takeUntil, catchError, finalize } from 'rxjs';

// Internal imports
import { ButtonComponent } from '../button/button.component';
import { ThemeService, ThemeType } from '../../../core/services/theme.service';
import { AuthService } from '../../../core/auth/auth.service';

interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  roles: string[];
}

@Component({
  selector: 'app-toolbar',
  template: `
    <mat-toolbar [ngClass]="{'elevated': elevated}" role="banner" [attr.aria-label]="ariaLabel">
      <!-- Navigation toggle -->
      <button *ngIf="showNavToggle"
              app-button
              variant="icon"
              color="primary"
              [attr.aria-expanded]="isMenuOpen"
              [attr.aria-label]="'Toggle navigation menu'"
              (click)="onNavToggle()">
        <mat-icon>menu</mat-icon>
      </button>

      <!-- Title -->
      <span class="toolbar-title" [attr.aria-label]="title">{{title}}</span>

      <span class="toolbar-spacer"></span>

      <!-- Theme toggle -->
      <button *ngIf="showThemeToggle"
              app-button
              variant="icon"
              color="primary"
              [attr.aria-pressed]="currentTheme === 'dark'"
              [attr.aria-label]="'Toggle theme'"
              matTooltip="Toggle dark mode"
              (click)="onThemeToggle()">
        <mat-icon>{{currentTheme === 'dark' ? 'light_mode' : 'dark_mode'}}</mat-icon>
      </button>

      <!-- User menu -->
      <button *ngIf="currentUser"
              app-button
              variant="icon"
              color="primary"
              [matMenuTriggerFor]="userMenu"
              [attr.aria-label]="'User menu'"
              class="user-menu-trigger">
        <img *ngIf="currentUser.avatar" 
             [src]="currentUser.avatar" 
             [alt]="currentUser.name"
             class="user-avatar"
             width="32"
             height="32">
        <mat-icon *ngIf="!currentUser.avatar">account_circle</mat-icon>
      </button>

      <!-- User dropdown menu -->
      <mat-menu #userMenu="matMenu" xPosition="before">
        <div class="user-menu-header" mat-menu-item disabled>
          <strong>{{currentUser?.name}}</strong>
          <small>{{currentUser?.email}}</small>
        </div>
        <mat-divider></mat-divider>
        <button mat-menu-item (click)="onLogout()">
          <mat-icon>logout</mat-icon>
          <span>Logout</span>
        </button>
      </mat-menu>
    </mat-toolbar>
  `,
  styles: [`
    :host {
      display: block;
    }

    .mat-toolbar {
      padding: 0 16px;
      transition: box-shadow 200ms cubic-bezier(0.4, 0, 0.2, 1);
    }

    .elevated {
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }

    .toolbar-title {
      margin-left: 16px;
      font-size: 20px;
      font-weight: 500;
    }

    .toolbar-spacer {
      flex: 1 1 auto;
    }

    .user-menu-trigger {
      margin-left: 8px;
    }

    .user-avatar {
      border-radius: 50%;
      object-fit: cover;
    }

    .user-menu-header {
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    @media (max-width: 768px) {
      .mat-toolbar {
        padding: 0 8px;
      }

      .toolbar-title {
        margin-left: 8px;
        font-size: 18px;
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    MatToolbarModule,
    MatIconModule,
    MatMenuModule,
    MatTooltipModule,
    ButtonComponent,
    NgClass,
    NgIf
  ]
})
export class ToolbarComponent implements OnInit, OnDestroy {
  @Input() title = 'Nexus Platform';
  @Input() showNavToggle = true;
  @Input() showThemeToggle = true;
  @Input() elevated = false;
  @Input() ariaLabel = 'Main toolbar';
  @Output() navToggled = new EventEmitter<void>();

  @HostBinding('class.mobile') isMobile = false;

  currentUser: User | null = null;
  currentTheme: ThemeType = 'light';
  isMenuOpen = false;

  private readonly destroy$ = new Subject<void>();

  constructor(
    private themeService: ThemeService,
    private authService: AuthService,
    private elementRef: ElementRef,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // Subscribe to theme changes
    this.themeService.theme$
      .pipe(takeUntil(this.destroy$))
      .subscribe(theme => {
        this.currentTheme = theme;
        this.cdr.markForCheck();
      });

    // Get current user
    this.currentUser = this.authService.getCurrentUser();

    // Initialize mobile detection
    this.checkMobileView();
    this.setupResizeListener();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onNavToggle(): void {
    this.isMenuOpen = !this.isMenuOpen;
    this.navToggled.emit();
  }

  onThemeToggle(): void {
    this.themeService.toggleTheme();
  }

  onLogout(): void {
    this.authService.logout();
  }

  private checkMobileView(): void {
    this.isMobile = window.innerWidth < 768;
  }

  private setupResizeListener(): void {
    const resizeObserver = new ResizeObserver(() => {
      this.checkMobileView();
      this.cdr.markForCheck();
    });

    resizeObserver.observe(this.elementRef.nativeElement);
  }
}