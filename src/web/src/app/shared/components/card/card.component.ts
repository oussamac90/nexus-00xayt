// @angular/core v16.x - Core Angular decorators and utilities
import { 
  Component, 
  Input, 
  Output, 
  EventEmitter, 
  ChangeDetectionStrategy 
} from '@angular/core';

// @angular/material/card v16.x - Material Design card implementation
import { MatCard, MatCardModule } from '@angular/material/card';

// @angular/material/core v16.x - Material Design ripple effect
import { MatRippleModule } from '@angular/material/core';

// Internal button component for card actions
import { ButtonComponent } from '../button/button.component';

/**
 * Enhanced Material Design card component implementing the Nexus Platform design system.
 * Provides a consistent container for content with configurable sections and responsive behavior.
 * 
 * @example
 * <app-card
 *   title="Product Details"
 *   subtitle="SKU: 12345"
 *   [elevation]="2"
 *   [outlined]="false"
 *   [clickable]="true"
 *   width="100%"
 *   height="auto"
 *   ariaLabel="Product card"
 *   (cardClick)="handleCardClick()">
 *   <ng-content></ng-content>
 * </app-card>
 */
@Component({
  selector: 'app-card',
  template: `
    <mat-card
      [ngClass]="getCardClasses()"
      [attr.aria-label]="ariaLabel"
      (click)="onCardClick($event)"
      matRipple
      [matRippleDisabled]="!clickable">
      
      <mat-card-header *ngIf="title || subtitle">
        <mat-card-title *ngIf="title">{{title}}</mat-card-title>
        <mat-card-subtitle *ngIf="subtitle">{{subtitle}}</mat-card-subtitle>
      </mat-card-header>

      <mat-card-content>
        <ng-content></ng-content>
      </mat-card-content>

      <mat-card-actions *ngIf="hasActions">
        <ng-content select="[cardActions]"></ng-content>
      </mat-card-actions>
    </mat-card>
  `,
  styles: [`
    :host {
      display: block;
    }

    mat-card {
      height: 100%;
      transition: box-shadow 200ms cubic-bezier(0.4, 0, 0.2, 1);
    }

    /* Clickable card styles */
    .card-clickable {
      cursor: pointer;
      user-select: none;
    }

    .card-clickable:hover {
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.12);
    }

    /* Outlined card styles */
    .card-outlined {
      border: 1px solid rgba(0, 0, 0, 0.12);
    }

    /* Responsive width classes */
    .card-full-width {
      width: 100%;
    }

    .card-auto-width {
      width: auto;
    }

    /* Responsive height classes */
    .card-full-height {
      height: 100%;
    }

    .card-auto-height {
      height: auto;
    }

    /* Material Design elevation classes */
    .mat-elevation-z0 { box-shadow: none; }
    .mat-elevation-z1 { box-shadow: 0 2px 1px -1px rgba(0,0,0,.2), 0 1px 1px 0 rgba(0,0,0,.14), 0 1px 3px 0 rgba(0,0,0,.12); }
    .mat-elevation-z2 { box-shadow: 0 3px 1px -2px rgba(0,0,0,.2), 0 2px 2px 0 rgba(0,0,0,.14), 0 1px 5px 0 rgba(0,0,0,.12); }
    .mat-elevation-z3 { box-shadow: 0 3px 3px -2px rgba(0,0,0,.2), 0 3px 4px 0 rgba(0,0,0,.14), 0 1px 8px 0 rgba(0,0,0,.12); }
    .mat-elevation-z4 { box-shadow: 0 2px 4px -1px rgba(0,0,0,.2), 0 4px 5px 0 rgba(0,0,0,.14), 0 1px 10px 0 rgba(0,0,0,.12); }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [MatCardModule, MatRippleModule, ButtonComponent],
  host: {
    'role': 'region',
    'tabindex': '0',
    '[attr.aria-label]': 'ariaLabel'
  }
})
export class CardComponent {
  /**
   * Card title displayed in the header
   */
  @Input() title?: string;

  /**
   * Card subtitle displayed below the title
   */
  @Input() subtitle?: string;

  /**
   * Material Design elevation level (0-4)
   */
  @Input() elevation: number = 1;

  /**
   * Whether to display an outlined variant instead of elevated
   */
  @Input() outlined: boolean = false;

  /**
   * Whether the card is clickable with hover effects
   */
  @Input() clickable: boolean = false;

  /**
   * Card width (CSS value or 'full' for 100%)
   */
  @Input() width: string = 'auto';

  /**
   * Card height (CSS value or 'full' for 100%)
   */
  @Input() height: string = 'auto';

  /**
   * Accessibility label for screen readers
   */
  @Input() ariaLabel?: string;

  /**
   * Event emitter for card click events
   */
  @Output() cardClick = new EventEmitter<void>();

  /**
   * Tracks whether the card has action buttons
   */
  hasActions: boolean = false;

  /**
   * Handles card click events with accessibility and ripple effects
   * @param event Click event object
   */
  onCardClick(event: Event): void {
    if (!this.clickable) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    // Emit click event
    this.cardClick.emit();

    // Handle keyboard events for accessibility
    if (event instanceof KeyboardEvent && event.key === 'Enter') {
      this.cardClick.emit();
    }
  }

  /**
   * Generates dynamic CSS classes based on card properties
   * @returns Object containing CSS class configurations
   */
  getCardClasses(): { [key: string]: boolean } {
    return {
      [`mat-elevation-z${this.elevation}`]: !this.outlined,
      'card-outlined': this.outlined,
      'card-clickable': this.clickable,
      'card-full-width': this.width === 'full',
      'card-auto-width': this.width === 'auto',
      'card-full-height': this.height === 'full',
      'card-auto-height': this.height === 'auto'
    };
  }
}