// @angular/core v16.x - Core Angular decorators and utilities
import { 
  Component, 
  Input, 
  Output, 
  EventEmitter, 
  ChangeDetectionStrategy, 
  OnInit, 
  ElementRef 
} from '@angular/core';

// @angular/material/button v16.x - Material Design button implementation
import { MatButton, MatButtonModule } from '@angular/material/button';

// @angular/material/core v16.x - Material Design ripple effect
import { MatRippleModule } from '@angular/material/core';

// Internal validation utilities
import { isValidButtonType } from '../../utils/validation.utils';

/**
 * Button types supported by the component
 */
export type ButtonType = 'button' | 'submit' | 'reset';

/**
 * Button variants following Material Design specifications
 */
export type ButtonVariant = 'text' | 'outlined' | 'contained' | 'icon';

/**
 * Button sizes with corresponding CSS classes
 */
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

/**
 * Button color themes
 */
export type ButtonColor = 'primary' | 'secondary' | 'accent' | 'warn';

/**
 * Enhanced Material Design button component with accessibility and performance optimizations.
 * Implements the Nexus Platform design system specifications.
 * 
 * @example
 * <app-button
 *   type="submit"
 *   variant="contained"
 *   size="md"
 *   color="primary"
 *   [disabled]="isDisabled"
 *   [loading]="isLoading"
 *   ariaLabel="Submit Form"
 *   (clicked)="handleClick()">
 *   Submit
 * </app-button>
 */
@Component({
  selector: 'app-button',
  template: `
    <button
      mat-button
      [type]="type"
      [disabled]="disabled || loading"
      [attr.aria-label]="ariaLabel"
      [attr.aria-disabled]="disabled || loading"
      [ngClass]="getButtonClasses()"
      (click)="onClick($event)">
      <mat-spinner
        *ngIf="loading"
        diameter="20"
        class="button-spinner">
      </mat-spinner>
      <span class="button-content" [class.visually-hidden]="loading">
        <ng-content></ng-content>
      </span>
    </button>
  `,
  styles: [`
    :host {
      display: inline-block;
    }

    .button-spinner {
      margin-right: 8px;
    }

    .button-content {
      display: inline-flex;
      align-items: center;
    }

    .visually-hidden {
      visibility: hidden;
    }

    /* Size variants */
    .btn-xs {
      padding: 4px 8px;
      font-size: 12px;
    }

    .btn-sm {
      padding: 6px 12px;
      font-size: 14px;
    }

    .btn-md {
      padding: 8px 16px;
      font-size: 16px;
    }

    .btn-lg {
      padding: 10px 20px;
      font-size: 18px;
    }

    .btn-xl {
      padding: 12px 24px;
      font-size: 20px;
    }

    /* Variant-specific styles */
    .btn-contained {
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }

    .btn-outlined {
      border: 1px solid currentColor;
    }

    .btn-icon {
      min-width: 40px;
      padding: 8px;
      border-radius: 50%;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [MatButtonModule, MatRippleModule],
  host: {
    'role': 'button',
    'tabindex': '0',
    '[attr.aria-disabled]': 'disabled || loading'
  }
})
export class ButtonComponent implements OnInit {
  /**
   * Button type attribute (button, submit, reset)
   */
  @Input() type: ButtonType = 'button';

  /**
   * Material Design variant (text, outlined, contained, icon)
   */
  @Input() variant: ButtonVariant = 'contained';

  /**
   * Button size (xs, sm, md, lg, xl)
   */
  @Input() size: ButtonSize = 'md';

  /**
   * Disabled state of the button
   */
  @Input() disabled = false;

  /**
   * Loading state showing spinner
   */
  @Input() loading = false;

  /**
   * Button color theme
   */
  @Input() color: ButtonColor = 'primary';

  /**
   * Accessibility label for screen readers
   */
  @Input() ariaLabel?: string;

  /**
   * Click event emitter with debouncing
   */
  @Output() clicked = new EventEmitter<void>();

  // Debounce timer for click events
  private clickTimer: any;

  constructor(private elementRef: ElementRef) {}

  ngOnInit(): void {
    // Validate button type on initialization
    if (!isValidButtonType(this.type)) {
      console.warn(`Invalid button type: ${this.type}. Defaulting to 'button'`);
      this.type = 'button';
    }
  }

  /**
   * Handles button click events with debouncing and accessibility
   * @param event Click event object
   */
  onClick(event: Event): void {
    // Prevent event bubbling
    event.preventDefault();
    event.stopPropagation();

    // Don't emit if button is disabled or loading
    if (this.disabled || this.loading) {
      return;
    }

    // Debounce click events (250ms)
    if (this.clickTimer) {
      clearTimeout(this.clickTimer);
    }

    this.clickTimer = setTimeout(() => {
      try {
        this.clicked.emit();
      } catch (error) {
        console.error('Error emitting button click event:', error);
      }
    }, 250);
  }

  /**
   * Generates memoized CSS classes based on button properties
   * @returns Object containing CSS class configurations
   */
  getButtonClasses(): { [key: string]: boolean } {
    return {
      [`mat-${this.variant}`]: true,
      [`mat-${this.color}`]: true,
      [`btn-${this.size}`]: true,
      [`btn-${this.variant}`]: true,
      'button-loading': this.loading,
      'button-disabled': this.disabled
    };
  }
}