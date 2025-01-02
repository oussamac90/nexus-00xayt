// @angular/core v16.x - Core Angular functionality
import { 
  Component, 
  Input, 
  Output, 
  EventEmitter, 
  OnInit, 
  OnDestroy, 
  ChangeDetectionStrategy, 
  ElementRef 
} from '@angular/core';

// @angular/animations v16.x - Animation capabilities
import { 
  trigger, 
  state, 
  style, 
  transition, 
  animate, 
  AnimationEvent 
} from '@angular/animations';

// rxjs v7.x - Reactive extensions
import { Subject, takeUntil } from 'rxjs';

// Internal utilities
import { validateMessage } from '../../utils/validation.utils';

// Toast type definitions
export const TOAST_TYPES = {
  SUCCESS: 'success',
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info'
} as const;

// Default configuration constants
export const DEFAULT_DURATION = 3000;
export const ANIMATION_DURATION = 300;

// Toast animation configuration
export const TOAST_ANIMATIONS = trigger('toastState', [
  state('void', style({
    opacity: 0,
    transform: 'translateY(20px)'
  })),
  state('visible', style({
    opacity: 1,
    transform: 'translateY(0)'
  })),
  transition('void => visible', animate('200ms ease-out')),
  transition('visible => void', animate('150ms ease-in'))
]);

@Component({
  selector: 'app-toast',
  templateUrl: './toast.component.html',
  styleUrls: ['./toast.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [TOAST_ANIMATIONS],
  host: {
    'role': 'alert',
    'aria-live': 'polite',
    '[class]': 'getToastClass()',
    '[@toastState]': 'visibilityState',
    '(@toastState.done)': 'onAnimationDone($event)'
  }
})
export class ToastComponent implements OnInit, OnDestroy {
  @Input() type: keyof typeof TOAST_TYPES = 'INFO';
  @Input() message = '';
  @Input() duration = DEFAULT_DURATION;
  @Input() icon?: string;
  @Output() closed = new EventEmitter<void>();

  private destroy$ = new Subject<void>();
  private dismissTimer?: number;
  visibilityState = 'void';

  constructor(private elementRef: ElementRef) {}

  ngOnInit(): void {
    // Validate inputs
    if (!validateMessage(this.message)) {
      console.error('Invalid toast message');
      return;
    }

    if (!Object.values(TOAST_TYPES).includes(this.type.toLowerCase() as any)) {
      console.warn(`Invalid toast type: ${this.type}, defaulting to INFO`);
      this.type = 'INFO';
    }

    // Initialize toast
    this.visibilityState = 'visible';
    
    // Set up auto-dismiss if duration is provided
    if (this.duration > 0) {
      this.dismissTimer = window.setTimeout(() => {
        this.close();
      }, this.duration);
    }

    // Set ARIA attributes based on type
    this.elementRef.nativeElement.setAttribute('aria-label', 
      `${this.type.toLowerCase()} notification: ${this.message}`
    );
  }

  ngOnDestroy(): void {
    // Clear any pending timers
    if (this.dismissTimer) {
      clearTimeout(this.dismissTimer);
    }

    // Complete all subscriptions
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Handles toast dismissal with animation
   */
  close(): void {
    // Clear dismiss timer if it exists
    if (this.dismissTimer) {
      clearTimeout(this.dismissTimer);
    }

    // Trigger close animation
    this.visibilityState = 'void';
    this.closed.emit();
  }

  /**
   * Handles animation completion
   */
  onAnimationDone(event: AnimationEvent): void {
    if (event.toState === 'void') {
      // Remove element from DOM after exit animation
      this.elementRef.nativeElement.remove();
    }
  }

  /**
   * Returns the CSS classes for the toast based on its type
   */
  getToastClass(): string {
    const baseClass = 'toast';
    const typeClass = `toast--${this.type.toLowerCase()}`;
    const iconClass = this.icon ? 'toast--with-icon' : '';
    
    return [baseClass, typeClass, iconClass]
      .filter(Boolean)
      .join(' ');
  }

  /**
   * Returns the icon class based on type if no custom icon is provided
   */
  getIconClass(): string {
    if (this.icon) {
      return this.icon;
    }

    const iconMap = {
      [TOAST_TYPES.SUCCESS]: 'check_circle',
      [TOAST_TYPES.ERROR]: 'error',
      [TOAST_TYPES.WARNING]: 'warning',
      [TOAST_TYPES.INFO]: 'info'
    };

    return iconMap[this.type.toLowerCase() as keyof typeof TOAST_TYPES] || 'info';
  }
}