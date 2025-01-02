import { Directive, ElementRef, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core'; // @angular/core v16.x

/**
 * Enum representing different network connection types for adaptive loading
 */
enum ConnectionType {
  SLOW_2G = '2g',
  THREE_G = '3g',
  FOUR_G = '4g',
  WIFI = 'wifi'
}

/**
 * Advanced lazy loading directive that implements efficient content loading strategies
 * with connection awareness, error handling, and accessibility support.
 * 
 * Features:
 * - Intersection Observer based lazy loading
 * - Connection-aware loading optimization
 * - Comprehensive error handling with retries
 * - Accessibility support with ARIA attributes
 * - Loading state management and events
 */
@Directive({
  selector: '[lazyLoad]'
})
export class LazyLoadDirective implements OnInit, OnDestroy {
  @Input() lazyLoadSrc!: string;
  @Input() defaultSrc?: string;
  @Output() loaded = new EventEmitter<boolean>();
  @Output() loadError = new EventEmitter<Error>();

  private observer: IntersectionObserver | null = null;
  private isLoading = false;
  private retryCount = 0;
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 2000;
  private connectionType: ConnectionType = ConnectionType.FOUR_G;

  // Observer configuration for optimal preloading
  private readonly observerOptions: IntersectionObserverInit = {
    root: null,
    rootMargin: '50px',
    threshold: [0, 0.25, 0.5, 0.75, 1]
  };

  constructor(private elementRef: ElementRef) {}

  ngOnInit(): void {
    this.initializeConnectionDetection();
    this.initializeLazyLoading();
    this.setupAccessibility();
  }

  ngOnDestroy(): void {
    this.cleanup();
  }

  /**
   * Initializes connection detection for adaptive loading
   */
  private initializeConnectionDetection(): void {
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      
      if (connection) {
        this.updateConnectionType(connection.effectiveType);
        connection.addEventListener('change', () => {
          this.updateConnectionType(connection.effectiveType);
        });
      }
    }
  }

  /**
   * Updates connection type and adjusts loading strategy
   */
  private updateConnectionType(type: string): void {
    switch (type) {
      case 'slow-2g':
      case '2g':
        this.connectionType = ConnectionType.SLOW_2G;
        break;
      case '3g':
        this.connectionType = ConnectionType.THREE_G;
        break;
      case '4g':
        this.connectionType = ConnectionType.FOUR_G;
        break;
      default:
        this.connectionType = ConnectionType.WIFI;
    }
  }

  /**
   * Initializes lazy loading with Intersection Observer
   */
  private initializeLazyLoading(): void {
    if (!('IntersectionObserver' in window)) {
      this.loadContent(); // Fallback for unsupported browsers
      return;
    }

    this.observer = new IntersectionObserver(
      (entries: IntersectionObserverEntry[]) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            this.loadContent();
            this.observer?.unobserve(entry.target);
          }
        });
      },
      this.observerOptions
    );

    this.observer.observe(this.elementRef.nativeElement);
  }

  /**
   * Sets up accessibility attributes for the lazy loaded element
   */
  private setupAccessibility(): void {
    const element = this.elementRef.nativeElement;
    element.setAttribute('aria-busy', 'true');
    element.setAttribute('aria-live', 'polite');
  }

  /**
   * Handles content loading with error handling and retries
   */
  private loadContent(): void {
    if (this.isLoading) return;

    const element = this.elementRef.nativeElement;
    this.isLoading = true;

    // Apply loading placeholder if available
    if (this.defaultSrc) {
      element.src = this.defaultSrc;
    }

    // Create new image for preloading
    const img = new Image();
    
    img.onload = () => {
      this.handleSuccessfulLoad(element, img.src);
    };

    img.onerror = (error: any) => {
      this.handleLoadError(error);
    };

    // Apply connection-aware loading delay for slow connections
    const loadDelay = this.getConnectionBasedDelay();
    setTimeout(() => {
      img.src = this.lazyLoadSrc;
    }, loadDelay);
  }

  /**
   * Calculates loading delay based on connection type
   */
  private getConnectionBasedDelay(): number {
    switch (this.connectionType) {
      case ConnectionType.SLOW_2G:
        return 1000;
      case ConnectionType.THREE_G:
        return 500;
      default:
        return 0;
    }
  }

  /**
   * Handles successful content load
   */
  private handleSuccessfulLoad(element: HTMLElement, src: string): void {
    element.src = src;
    element.removeAttribute('aria-busy');
    this.isLoading = false;
    this.retryCount = 0;
    this.loaded.emit(true);
  }

  /**
   * Handles load errors with retry mechanism
   */
  private handleLoadError(error: any): void {
    if (this.retryCount < this.MAX_RETRIES) {
      this.retryCount++;
      setTimeout(() => {
        this.loadContent();
      }, this.RETRY_DELAY);
    } else {
      this.isLoading = false;
      this.elementRef.nativeElement.removeAttribute('aria-busy');
      this.loadError.emit(new Error('Failed to load content after maximum retries'));
    }
  }

  /**
   * Performs comprehensive cleanup of resources
   */
  private cleanup(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }

    // Clean up connection detection listener if available
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      if (connection) {
        connection.removeEventListener('change', this.updateConnectionType);
      }
    }

    // Reset element state
    const element = this.elementRef.nativeElement;
    element.removeAttribute('aria-busy');
    element.removeAttribute('aria-live');
    
    this.isLoading = false;
  }
}