import { 
  Component, 
  Input, 
  Output, 
  EventEmitter, 
  OnInit, 
  OnDestroy, 
  ChangeDetectionStrategy,
  ViewChild,
  ElementRef,
  ViewEncapsulation
} from '@angular/core';
import { FormControl, Validators } from '@angular/forms';
import { MatFormFieldModule, MatSelectModule, MatSelect } from '@angular/material';
import { Subject } from 'rxjs';
import { takeUntil, debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { setupFormValueChanges, sanitizeInput } from '../../utils/form.utils';

// Animation duration for dropdown open/close in milliseconds
const DROPDOWN_ANIMATION_DURATION = 200;

// Debounce time for search input in milliseconds
const SEARCH_DEBOUNCE_TIME = 300;

// Maximum number of selections allowed in multi-select mode
const MAX_SELECTION_LIMIT = 100;

@Component({
  selector: 'app-dropdown',
  templateUrl: './dropdown.component.html',
  styleUrls: ['./dropdown.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None
})
export class DropdownComponent implements OnInit, OnDestroy {
  // Input properties with secure defaults
  @Input() label = '';
  @Input() options: any[] = [];
  @Input() multiple = false;
  @Input() searchable = false;
  @Input() placeholder = '';
  @Input() required = false;
  @Input() disabled = false;
  @Input() errorMessage = '';
  @Input() maxSelections = MAX_SELECTION_LIMIT;
  @Input() ariaLabel = '';

  // Output events
  @Output() selectionChange = new EventEmitter<any>();
  @Output() searchChange = new EventEmitter<string>();

  // ViewChild reference to Material Select component
  @ViewChild('matSelect') matSelect!: MatSelect;

  // Form control for the dropdown
  control: FormControl;

  // Subject for managing subscriptions
  private destroy$ = new Subject<void>();

  // Component state
  isLoading = false;
  filteredOptions: any[] = [];

  constructor() {
    // Initialize form control with validators
    this.control = new FormControl(
      null, 
      this.required ? [Validators.required] : []
    );

    // Initialize filtered options
    this.filteredOptions = [...this.options];
  }

  ngOnInit(): void {
    // Set up form control value changes
    setupFormValueChanges(
      this.control,
      this.destroy$,
      (value) => this.handleValueChange(value)
    );

    // Set up search functionality if enabled
    if (this.searchable) {
      this.setupSearch();
    }

    // Set initial accessibility attributes
    this.setupAccessibility();

    // Apply any disabled state
    if (this.disabled) {
      this.control.disable();
    }
  }

  ngOnDestroy(): void {
    // Clean up subscriptions
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Handles selection changes with validation and sanitization
   */
  onSelectionChange(event: any): void {
    try {
      let selectedValue = event.value;

      // Validate selection limit for multi-select
      if (this.multiple && Array.isArray(selectedValue)) {
        if (selectedValue.length > this.maxSelections) {
          selectedValue = selectedValue.slice(0, this.maxSelections);
          console.warn(`Selection limited to ${this.maxSelections} items`);
        }
      }

      // Update form control and emit change event
      this.control.setValue(selectedValue, { emitEvent: true });
      this.selectionChange.emit(selectedValue);

      // Update ARIA attributes
      this.updateAriaAttributes(selectedValue);
    } catch (error) {
      console.error('Error handling selection change:', error);
    }
  }

  /**
   * Filters options based on search term with sanitization
   */
  filterOptions(searchTerm: string): void {
    try {
      // Sanitize search input
      const sanitizedTerm = sanitizeInput(searchTerm.toLowerCase().trim());

      // Filter options
      this.filteredOptions = this.options.filter(option => 
        option.label?.toLowerCase().includes(sanitizedTerm) ||
        option.value?.toString().toLowerCase().includes(sanitizedTerm)
      );

      // Emit search change event
      this.searchChange.emit(sanitizedTerm);

      // Update ARIA attributes for filtered results
      this.matSelect?.nativeElement?.setAttribute(
        'aria-expanded', 'true'
      );
      this.matSelect?.nativeElement?.setAttribute(
        'aria-owns', 'dropdown-options'
      );
    } catch (error) {
      console.error('Error filtering options:', error);
      this.filteredOptions = [...this.options];
    }
  }

  /**
   * Sets up search functionality with debounce
   */
  private setupSearch(): void {
    const searchControl = new FormControl('');
    searchControl.valueChanges.pipe(
      debounceTime(SEARCH_DEBOUNCE_TIME),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe({
      next: (term: string) => this.filterOptions(term),
      error: (error) => console.error('Search error:', error)
    });
  }

  /**
   * Sets up initial accessibility attributes
   */
  private setupAccessibility(): void {
    if (this.matSelect?.nativeElement) {
      this.matSelect.nativeElement.setAttribute(
        'role', 'combobox'
      );
      this.matSelect.nativeElement.setAttribute(
        'aria-label', this.ariaLabel || this.label
      );
      this.matSelect.nativeElement.setAttribute(
        'aria-required', this.required.toString()
      );
      this.matSelect.nativeElement.setAttribute(
        'aria-disabled', this.disabled.toString()
      );
    }
  }

  /**
   * Updates ARIA attributes based on selection state
   */
  private updateAriaAttributes(value: any): void {
    if (this.matSelect?.nativeElement) {
      const hasValue = this.multiple ? 
        value?.length > 0 : 
        value !== null && value !== undefined;

      this.matSelect.nativeElement.setAttribute(
        'aria-invalid', 
        (!hasValue && this.required).toString()
      );
    }
  }

  /**
   * Handles form control value changes
   */
  private handleValueChange(value: any): void {
    try {
      // Validate value
      if (this.multiple && Array.isArray(value)) {
        if (value.length > this.maxSelections) {
          value = value.slice(0, this.maxSelections);
          this.control.setValue(value, { emitEvent: false });
        }
      }

      // Update ARIA attributes
      this.updateAriaAttributes(value);
    } catch (error) {
      console.error('Error handling value change:', error);
    }
  }
}