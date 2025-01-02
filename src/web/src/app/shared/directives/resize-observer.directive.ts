import { 
  Directive, 
  ElementRef, 
  EventEmitter, 
  OnDestroy, 
  OnInit, 
  Output 
} from '@angular/core';

/**
 * Enhanced directive that provides type-safe element size observation with performance optimizations
 * and comprehensive error handling. Implements responsive design requirements by monitoring element
 * size changes across different breakpoints.
 * 
 * @example
 * <div appResizeObserver (sizeChange)="onSizeChange($event)">Resizable content</div>
 * 
 * @version Angular 16.x
 */
@Directive({
  selector: '[appResizeObserver]'
})
export class ResizeObserverDirective implements OnInit, OnDestroy {
  /**
   * Emits the new dimensions of the observed element whenever it changes size.
   * Provides type-safe DOMRectReadOnly containing width, height, and position data.
   */
  @Output() sizeChange = new EventEmitter<DOMRectReadOnly>();

  private observer: ResizeObserver | null = null;
  private debounceTimer: number | null = null;
  private isObserving = false;
  private readonly DEBOUNCE_MS = 16; // ~1 frame @60fps for optimal performance

  constructor(private elementRef: ElementRef<HTMLElement>) {
    if (!elementRef?.nativeElement) {
      throw new Error('ResizeObserverDirective requires a valid element reference');
    }
  }

  /**
   * Initializes the ResizeObserver with error handling and browser compatibility check.
   * Sets up observation of the host element and emits initial size measurement.
   */
  ngOnInit(): void {
    try {
      if (!window.ResizeObserver) {
        console.warn('ResizeObserver API is not supported in this browser');
        return;
      }

      this.setupObserver();
    } catch (error) {
      console.error('Failed to initialize ResizeObserver:', error);
      // Emit error to application error handling system if available
      // this.errorHandler.handleError(error);
    }
  }

  /**
   * Enhanced cleanup that ensures proper disposal of ResizeObserver and associated resources.
   * Prevents memory leaks and ensures all subscriptions are properly cleared.
   */
  ngOnDestroy(): void {
    try {
      if (this.debounceTimer) {
        window.clearTimeout(this.debounceTimer);
        this.debounceTimer = null;
      }

      if (this.observer) {
        this.observer.disconnect();
        this.observer = null;
      }

      this.isObserving = false;
      this.sizeChange.complete();
    } catch (error) {
      console.error('Error during ResizeObserver cleanup:', error);
    }
  }

  /**
   * Sets up the ResizeObserver with comprehensive error handling and performance optimizations.
   * Implements the core observation functionality with proper type checking.
   */
  private setupObserver(): void {
    try {
      this.observer = new ResizeObserver((entries: ResizeObserverEntry[]) => {
        this.onResize(entries);
      });

      this.observer.observe(this.elementRef.nativeElement, {
        box: 'border-box'
      });

      this.isObserving = true;
    } catch (error) {
      console.error('Failed to setup ResizeObserver:', error);
      this.isObserving = false;
    }
  }

  /**
   * Handles resize observations with debouncing and comprehensive error handling.
   * Optimizes performance by limiting the frequency of size change emissions.
   * 
   * @param entries - Array of ResizeObserverEntry objects containing size information
   */
  private onResize(entries: ResizeObserverEntry[]): void {
    try {
      if (!entries || !entries.length) {
        return;
      }

      // Clear any existing debounce timer
      if (this.debounceTimer) {
        window.clearTimeout(this.debounceTimer);
      }

      // Debounce the size change emission
      this.debounceTimer = window.setTimeout(() => {
        const entry = entries[0];
        if (!entry) {
          return;
        }

        // Extract the content rect with proper type safety
        const contentRect: DOMRectReadOnly = entry.contentRect;

        // Validate dimensions before emitting
        if (contentRect.width >= 0 && contentRect.height >= 0) {
          this.sizeChange.emit(contentRect);
        }

        this.debounceTimer = null;
      }, this.DEBOUNCE_MS);
    } catch (error) {
      console.error('Error processing resize observation:', error);
      // Optionally emit error to application error handling system
    }
  }
}