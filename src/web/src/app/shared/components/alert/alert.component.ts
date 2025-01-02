// @angular/core v16.x - Core Angular functionality
import { 
  Component, 
  Input, 
  Output, 
  EventEmitter, 
  OnInit, 
  OnDestroy, 
  ChangeDetectionStrategy 
} from '@angular/core';

// @angular/animations v16.x - Animation capabilities
import {
  trigger,
  state,
  style,
  transition,
  animate
} from '@angular/animations';

// rxjs v7.x - Reactive extensions
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

// Internal utilities
import { validateMessage } from '../../utils/validation.utils';

/**
 * Alert type definitions for strong typing
 */
export const ALERT_TYPES = {
  SUCCESS: 'success',
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info'
} as const;

export type AlertType = typeof ALERT_TYPES[keyof typeof ALERT_TYPES];

/**
 * Animation configuration
 */
const ALERT_ANIMATION_DURATION = 200;
const ALERT_ANIMATION_STATES = {
  VISIBLE: 'visible',
  HIDDEN: 'hidden'
} as const;

/**
 * Enterprise-grade alert component for displaying important messages
 * with animation, accessibility, and proper cleanup support.
 */
@Component({
  selector: 'app-alert',
  templateUrl: './alert.component.html',
  styleUrls: ['./alert.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [
    trigger('alertState', [
      state(ALERT_ANIMATION_STATES.VISIBLE, style({
        opacity: 1,
        transform: 'translateY(0)'
      })),
      state(ALERT_ANIMATION_STATES.HIDDEN, style({
        opacity: 0,
        transform: 'translateY(-100%)'
      })),
      transition(`* => ${ALERT_ANIMATION_STATES.VISIBLE}`, [
        animate(`${ALERT_ANIMATION_DURATION}ms ease-out`)
      ]),
      transition(`* => ${ALERT_ANIMATION_STATES.HIDDEN}`, [
        animate(`${ALERT_ANIMATION_DURATION}ms ease-in`)
      ])
    ])
  ],
  host: {
    'role': 'alert',
    'aria-live': 'assertive',
    '[attr.aria-label]': 'ariaLabel',
    '[class.alert--dismissible]': 'dismissible'
  }
})
export class AlertComponent implements OnInit, OnDestroy {
  /**
   * Input properties with strong typing
   */
  @Input() type: AlertType = ALERT_TYPES.INFO;
  @Input() message = '';
  @Input() dismissible = true;
  @Input() icon?: string;
  @Input() ariaLabel?: string;

  /**
   * Output events
   */
  @Output() closed = new EventEmitter<void>();

  /**
   * Component state
   */
  protected currentState = ALERT_ANIMATION_STATES.VISIBLE;
  protected visible = true;
  private readonly destroy$ = new Subject<void>();

  /**
   * Lifecycle hook: Initialize component
   */
  ngOnInit(): void {
    // Validate message content
    if (!validateMessage(this.message)) {
      console.error('Invalid alert message provided');
      this.message = 'An error occurred';
    }

    // Validate alert type
    if (!Object.values(ALERT_TYPES).includes(this.type)) {
      console.warn(`Invalid alert type: ${this.type}, defaulting to info`);
      this.type = ALERT_TYPES.INFO;
    }

    // Set default aria label if not provided
    if (!this.ariaLabel) {
      this.ariaLabel = `${this.type} alert: ${this.message}`;
    }

    // Set default icon if not provided
    if (!this.icon) {
      this.icon = this.getDefaultIcon();
    }
  }

  /**
   * Lifecycle hook: Cleanup subscriptions
   */
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Handles alert dismissal with animation
   */
  close(): void {
    this.currentState = ALERT_ANIMATION_STATES.HIDDEN;
    
    // Wait for animation to complete before emitting
    setTimeout(() => {
      this.visible = false;
      this.closed.emit();
    }, ALERT_ANIMATION_DURATION);
  }

  /**
   * Returns the CSS classes for the alert based on type
   */
  protected getAlertClass(): string {
    const baseClass = 'alert';
    return `${baseClass} ${baseClass}--${this.type}`;
  }

  /**
   * Returns the default icon based on alert type
   */
  private getDefaultIcon(): string {
    const icons = {
      [ALERT_TYPES.SUCCESS]: 'check_circle',
      [ALERT_TYPES.ERROR]: 'error',
      [ALERT_TYPES.WARNING]: 'warning',
      [ALERT_TYPES.INFO]: 'info'
    };
    return icons[this.type];
  }

  /**
   * Checks if the alert should be displayed
   */
  protected get shouldDisplay(): boolean {
    return this.visible && !!this.message;
  }
}
```

This implementation includes:

1. Strong typing with TypeScript for alert types and states
2. Smooth animations using Angular's animation system
3. Accessibility support with ARIA attributes
4. Input validation and error handling
5. Proper cleanup with RxJS
6. OnPush change detection for better performance
7. Comprehensive error handling and logging
8. Default values and fallbacks for all properties
9. Type-safe icon mapping
10. Enterprise-grade component structure following Angular best practices

The component can be used in templates like:

```html
<app-alert
  type="success"
  message="Operation completed successfully"
  [dismissible]="true"
  (closed)="handleAlertClosed()">
</app-alert>