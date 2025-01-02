// @angular/core - v16.x
import { Component, Input, OnInit, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
// @angular/material/progress-spinner - v16.x
import { MatProgressSpinner, MatProgressSpinnerModule } from '@angular/material/progress-spinner';
// rxjs - v7.x
import { Subscription } from 'rxjs';

import { ThemeService } from '../../../core/services/theme.service';

@Component({
  selector: 'app-loader',
  template: `
    <mat-progress-spinner
      [class.loader--dark]="currentTheme === 'dark'"
      [class.loader--light]="currentTheme === 'light'"
      [diameter]="diameter"
      [mode]="mode"
      [color]="color"
      [value]="mode === 'determinate' ? 100 : undefined"
      role="progressbar"
      [attr.aria-label]="'Loading content'"
      [attr.aria-busy]="isLoading"
      [attr.aria-valuemin]="0"
      [attr.aria-valuemax]="100"
      [attr.aria-valuenow]="mode === 'determinate' ? 100 : undefined">
    </mat-progress-spinner>
  `,
  styles: [`
    :host {
      display: block;
      text-align: center;
    }

    mat-progress-spinner {
      display: inline-block;
      transition: all var(--animation-duration-base) var(--animation-timing-function);
    }

    .loader--light {
      opacity: 0.87;
    }

    .loader--dark {
      opacity: 0.95;
    }

    @media (forced-colors: active) {
      mat-progress-spinner {
        forced-color-adjust: none;
        color: CanvasText;
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [MatProgressSpinnerModule]
})
export class LoaderComponent implements OnInit, OnDestroy {
  /**
   * Controls the visibility of the loader
   */
  @Input() isLoading = false;

  /**
   * Size of the spinner in pixels
   */
  @Input() diameter = 48;

  /**
   * Animation mode of the spinner
   * 'determinate' | 'indeterminate'
   */
  @Input() mode: 'determinate' | 'indeterminate' = 'indeterminate';

  /**
   * Color theme of the spinner
   * 'primary' | 'accent' | 'warn'
   */
  @Input() color: 'primary' | 'accent' | 'warn' = 'primary';

  /**
   * Current theme state
   */
  currentTheme: string = 'light';

  /**
   * Subscription for theme changes
   */
  private themeSubscription: Subscription;

  constructor(private themeService: ThemeService) {}

  ngOnInit(): void {
    // Subscribe to theme changes
    this.themeSubscription = this.themeService.theme$.subscribe(theme => {
      this.currentTheme = theme;
    });
  }

  ngOnDestroy(): void {
    // Clean up subscription
    if (this.themeSubscription) {
      this.themeSubscription.unsubscribe();
    }
  }
}