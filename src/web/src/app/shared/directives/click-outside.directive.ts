import { 
  Directive, 
  ElementRef, 
  EventEmitter, 
  HostListener, 
  Input, 
  Output, 
  OnDestroy 
} from '@angular/core'; // @angular/core v16.x

@Directive({
  selector: '[clickOutside]'
})
export class ClickOutsideDirective implements OnDestroy {
  @Output() clickOutside = new EventEmitter<void>();
  @Input() isEnabled = true;
  @Input() debounceTime = 100;

  private debounceTimer: number | null = null;

  constructor(private elementRef: ElementRef) {}

  @HostListener('document:click', ['$event'])
  @HostListener('document:touchend', ['$event'])
  onClick(event: Event): void {
    if (!this.isEnabled) {
      return;
    }

    // Ensure event exists and has a target
    if (!event || !event.target) {
      return;
    }

    const clickedElement = event.target as HTMLElement;

    // Handle shadow DOM traversal
    const path = event.composedPath?.() || [];
    const isInShadowDOM = path.length > 0;

    // Check if click was outside the host element
    const isOutside = isInShadowDOM 
      ? !path.includes(this.elementRef.nativeElement)
      : !this.elementRef.nativeElement.contains(clickedElement);

    if (isOutside) {
      // Clear any existing timer
      if (this.debounceTimer !== null) {
        window.clearTimeout(this.debounceTimer);
      }

      // Set new debounce timer
      this.debounceTimer = window.setTimeout(() => {
        this.clickOutside.emit();
        this.debounceTimer = null;
      }, this.debounceTime);
    }
  }

  @HostListener('document:keydown.escape', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    if (!this.isEnabled) {
      return;
    }

    if (event.key === 'Escape') {
      // Emit immediately for keyboard events - no debounce needed
      this.clickOutside.emit();
    }
  }

  ngOnDestroy(): void {
    // Clear any pending debounce timer
    if (this.debounceTimer !== null) {
      window.clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    // Clean up event emitter
    this.clickOutside.complete();
  }
}
```

This implementation provides a robust click-outside directive with the following features:

1. Debounced click handling to prevent multiple rapid triggers
2. Support for both mouse clicks and touch events
3. Shadow DOM traversal support using composedPath
4. Keyboard accessibility through Escape key support
5. Configurable enable/disable state
6. Adjustable debounce timing
7. Proper cleanup on destroy
8. Type safety throughout the implementation
9. Performance optimizations through debouncing
10. Comprehensive event handling for both standard DOM and shadow DOM

The directive can be used in templates like:
```html
<div [clickOutside]="true" (clickOutside)="handleClickOutside()" [debounceTime]="200">
  <!-- content -->
</div>