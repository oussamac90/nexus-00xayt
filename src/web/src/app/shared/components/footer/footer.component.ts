// @angular/core - v16.x
import { Component, OnInit, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
// rxjs - v7.x
import { Observable, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
// @angular/material/button - v16.x
import { MatButtonModule } from '@angular/material/button';
// @angular/material/icon - v16.x
import { MatIconModule } from '@angular/material/icon';
// @angular/material/core - v16.x
import { MatRippleModule } from '@angular/material/core';

import { ThemeService } from '../../../core/services/theme.service';

const CURRENT_YEAR = new Date().getFullYear();

@Component({
  selector: 'app-footer',
  templateUrl: './footer.component.html',
  styleUrls: ['./footer.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    MatButtonModule,
    MatIconModule,
    MatRippleModule
  ]
})
export class FooterComponent implements OnInit, OnDestroy {
  currentTheme$: Observable<string>;
  currentYear: number = CURRENT_YEAR;
  private readonly destroy$ = new Subject<void>();

  constructor(private themeService: ThemeService) {
    this.currentTheme$ = this.themeService.theme$.pipe(
      takeUntil(this.destroy$)
    );
  }

  ngOnInit(): void {
    // Set up accessibility attributes
    this.setupAccessibility();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Toggles the application theme with accessibility announcement
   */
  toggleTheme(): void {
    this.themeService.toggleTheme();
    
    // Announce theme change to screen readers
    const newTheme = this.themeService.getCurrentTheme();
    const announcement = `Theme changed to ${newTheme} mode`;
    this.announceThemeChange(announcement);
  }

  /**
   * Sets up accessibility attributes for the footer
   */
  private setupAccessibility(): void {
    const footer = document.querySelector('app-footer');
    if (footer) {
      footer.setAttribute('role', 'contentinfo');
      footer.setAttribute('aria-label', 'Application footer');
    }

    // Set up theme toggle button accessibility
    const themeToggle = document.querySelector('[data-test="theme-toggle"]');
    if (themeToggle) {
      themeToggle.setAttribute('role', 'switch');
      themeToggle.setAttribute('aria-label', 'Toggle theme');
      this.currentTheme$.subscribe(theme => {
        themeToggle.setAttribute('aria-checked', theme === 'dark' ? 'true' : 'false');
      });
    }
  }

  /**
   * Announces theme changes to screen readers
   */
  private announceThemeChange(message: string): void {
    const announcer = document.createElement('div');
    announcer.setAttribute('aria-live', 'polite');
    announcer.classList.add('cdk-visually-hidden');
    announcer.textContent = message;
    document.body.appendChild(announcer);

    // Remove after announcement
    setTimeout(() => {
      document.body.removeChild(announcer);
    }, 1000);
  }
}