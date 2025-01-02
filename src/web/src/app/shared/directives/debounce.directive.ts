// @angular/core v16.x
import {
  Directive,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  OnDestroy,
  OnInit
} from '@angular/core';

// rxjs v7.x
import {
  Subject,
  Subscription,
  debounceTime,
  takeUntil
} from 'rxjs';

import { FORM_DEBOUNCE_TIME } from '../utils/form.utils';

/**
 * Directive that adds configurable debounce functionality to input events
 * Optimizes form performance by reducing the frequency of event processing
 * Implements proper resource cleanup and accessibility support
 */
@Directive({
  selector: '[appDebounce]'
})
export class DebounceDirective implements OnInit, OnDestroy {
  /**
   * Custom debounce time in milliseconds
   * Falls back to FORM_DEBOUNCE_TIME if not specified
   */
  @Input() debounceTime: number = FORM_DEBOUNCE_TIME;

  /**
   * Emits the debounced input value
   */
  @Output() debounceEvent = new EventEmitter<any>();

  /**
   * Subject for managing component cleanup
   */
  private readonly destroy$ = new Subject<void>();

  /**
   * Subject for handling input events
   */
  private readonly inputSubject = new Subject<any>();

  /**
   * Subscription for input event handling
   */
  private inputSubscription?: Subscription;

  constructor(private readonly el: ElementRef) {
    // Add ARIA attributes for accessibility
    this.el.nativeElement.setAttribute('aria-live', 'polite');
  }

  ngOnInit(): void {
    // Validate debounce time
    if (this.debounceTime < 0) {
      console.warn('Invalid debounce time provided, using default value');
      this.debounceTime = FORM_DEBOUNCE_TIME;
    }

    // Setup debounced input handling
    this.inputSubscription = this.inputSubject.pipe(
      debounceTime(this.debounceTime),
      takeUntil(this.destroy$)
    ).subscribe({
      next: (value: any) => {
        try {
          this.debounceEvent.emit(value);
          // Update ARIA attributes to reflect input processing
          this.el.nativeElement.setAttribute('aria-busy', 'false');
        } catch (error) {
          console.error('Error processing debounced input:', error);
          this.el.nativeElement.setAttribute('aria-invalid', 'true');
        }
      },
      error: (error: any) => {
        console.error('Error in debounce subscription:', error);
        this.el.nativeElement.setAttribute('aria-invalid', 'true');
      }
    });
  }

  ngOnDestroy(): void {
    // Complete subjects and unsubscribe
    this.destroy$.next();
    this.destroy$.complete();
    this.inputSubject.complete();
    
    if (this.inputSubscription) {
      this.inputSubscription.unsubscribe();
    }

    // Clean up ARIA attributes
    this.el.nativeElement.removeAttribute('aria-live');
    this.el.nativeElement.removeAttribute('aria-busy');
    this.el.nativeElement.removeAttribute('aria-invalid');
  }

  /**
   * Handles input events with validation and error handling
   * Updates ARIA attributes for accessibility feedback
   */
  onInput(event: Event): void {
    try {
      event.preventDefault();
      
      const target = event.target as HTMLInputElement;
      if (!target) {
        throw new Error('Invalid event target');
      }

      // Mark input as processing
      this.el.nativeElement.setAttribute('aria-busy', 'true');
      
      // Push value to subject for debouncing
      this.inputSubject.next(target.value);
      
      // Reset error state
      this.el.nativeElement.removeAttribute('aria-invalid');
    } catch (error) {
      console.error('Error handling input event:', error);
      this.el.nativeElement.setAttribute('aria-invalid', 'true');
    }
  }
}