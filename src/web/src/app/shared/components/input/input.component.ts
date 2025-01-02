// @angular/core v16.x
import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
  ElementRef,
  ChangeDetectorRef
} from '@angular/core';

// @angular/forms v16.x
import {
  FormControl,
  ControlValueAccessor,
  NG_VALUE_ACCESSOR,
  NgControl,
  Validators
} from '@angular/forms';

// rxjs v7.x
import {
  Subject,
  takeUntil,
  debounceTime,
  distinctUntilChanged
} from 'rxjs';

// Internal utilities
import {
  markFormGroupTouched,
  getFormValidationErrors
} from '../../../shared/utils/form.utils';

import {
  emailValidator,
  phoneNumberValidator,
  taxIdValidator,
  passwordValidator,
  MAX_INPUT_LENGTH,
  PASSWORD_PATTERN
} from '../../../shared/utils/validation.utils';

@Component({
  selector: 'app-input',
  template: `
    <div class="input-container" [class.error]="hasError">
      <label 
        [for]="id" 
        class="input-label"
        [class.required]="required"
        [attr.aria-label]="label">
        {{ label }}
      </label>
      
      <div class="input-wrapper">
        <input
          #inputElement
          [id]="id"
          [type]="type"
          [name]="name"
          [placeholder]="placeholder"
          [value]="value"
          [disabled]="disabled"
          [attr.maxlength]="maxLength"
          [attr.pattern]="pattern"
          [attr.autocomplete]="autocomplete"
          [attr.aria-required]="required"
          [attr.aria-invalid]="hasError"
          [attr.aria-describedby]="errorId"
          (input)="onInputChange($event)"
          (blur)="onTouched()"
        />
      </div>

      <div 
        *ngIf="hasError"
        [id]="errorId"
        class="error-message"
        role="alert"
        aria-live="polite">
        {{ errorMessage }}
      </div>
    </div>
  `,
  styles: [`
    .input-container {
      margin-bottom: 1rem;
    }

    .input-label {
      display: block;
      margin-bottom: 0.5rem;
      font-weight: 500;
    }

    .input-label.required::after {
      content: "*";
      color: #d32f2f;
      margin-left: 0.25rem;
    }

    .input-wrapper {
      position: relative;
    }

    input {
      width: 100%;
      padding: 0.75rem;
      border: 1px solid #424242;
      border-radius: 4px;
      font-size: 1rem;
      line-height: 1.5;
      transition: border-color 0.2s ease;
    }

    input:focus {
      outline: none;
      border-color: #1976D2;
      box-shadow: 0 0 0 2px rgba(25, 118, 210, 0.2);
    }

    input:disabled {
      background-color: #f5f5f5;
      cursor: not-allowed;
    }

    .error input {
      border-color: #d32f2f;
    }

    .error-message {
      color: #d32f2f;
      font-size: 0.875rem;
      margin-top: 0.25rem;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: InputComponent,
      multi: true
    }
  ]
})
export class InputComponent implements OnInit, OnDestroy, ControlValueAccessor {
  @Input() label = '';
  @Input() placeholder = '';
  @Input() type: 'text' | 'email' | 'password' | 'tel' | 'number' = 'text';
  @Input() required = false;
  @Input() name = '';
  @Input() id = '';
  @Input() disabled = false;
  @Input() validationTypes: string[] = [];
  @Input() maxLength = MAX_INPUT_LENGTH;
  @Input() pattern = '';
  @Input() autocomplete = 'off';

  @Output() valueChange = new EventEmitter<any>();
  @Output() validationChange = new EventEmitter<boolean>();

  private destroy$ = new Subject<void>();
  private control: FormControl;
  private value: any = '';
  
  errorId = `${this.id}-error`;
  hasError = false;
  errorMessage = '';

  onChange: any = () => {};
  onTouched: any = () => {};

  constructor(
    private ngControl: NgControl,
    private elementRef: ElementRef,
    private cdr: ChangeDetectorRef
  ) {
    if (this.ngControl) {
      this.ngControl.valueAccessor = this;
    }
  }

  ngOnInit(): void {
    this.initializeControl();
    this.setupValidation();
    this.setupValueChanges();
    this.setupAccessibility();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initializeControl(): void {
    this.control = this.ngControl?.control as FormControl || new FormControl('');
    this.id = this.id || `input-${Math.random().toString(36).substr(2, 9)}`;
    this.errorId = `${this.id}-error`;
  }

  private setupValidation(): void {
    const validators = [];

    if (this.required) {
      validators.push(Validators.required);
    }

    if (this.maxLength) {
      validators.push(Validators.maxLength(this.maxLength));
    }

    if (this.pattern) {
      validators.push(Validators.pattern(this.pattern));
    }

    // Add specific validators based on type
    switch (this.type) {
      case 'email':
        validators.push(emailValidator);
        break;
      case 'tel':
        validators.push(phoneNumberValidator);
        break;
      case 'password':
        validators.push(passwordValidator);
        break;
    }

    // Add custom validators from validationTypes
    if (this.validationTypes.includes('taxId')) {
      validators.push(taxIdValidator);
    }

    this.control.setValidators(validators);
    this.control.updateValueAndValidity();
  }

  private setupValueChanges(): void {
    this.control.valueChanges.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(value => {
      this.validateInput(value);
      this.valueChange.emit(value);
    });
  }

  private setupAccessibility(): void {
    const input = this.elementRef.nativeElement.querySelector('input');
    if (input) {
      input.setAttribute('aria-required', this.required.toString());
      input.setAttribute('aria-invalid', 'false');
      if (this.label) {
        input.setAttribute('aria-label', this.label);
      }
    }
  }

  writeValue(value: any): void {
    this.value = value;
    this.cdr.markForCheck();
  }

  registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
    this.cdr.markForCheck();
  }

  onInputChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = input.value;
    
    this.value = value;
    this.onChange(value);
    this.validateInput(value);
  }

  private validateInput(value: any): void {
    this.control.setValue(value, { emitEvent: false });
    
    if (this.control.errors) {
      this.hasError = true;
      this.errorMessage = this.getErrorMessage(this.control.errors);
      this.validationChange.emit(false);
    } else {
      this.hasError = false;
      this.errorMessage = '';
      this.validationChange.emit(true);
    }

    this.updateAccessibilityAttributes();
    this.cdr.markForCheck();
  }

  private updateAccessibilityAttributes(): void {
    const input = this.elementRef.nativeElement.querySelector('input');
    if (input) {
      input.setAttribute('aria-invalid', this.hasError.toString());
      if (this.hasError) {
        input.setAttribute('aria-describedby', this.errorId);
      } else {
        input.removeAttribute('aria-describedby');
      }
    }
  }

  private getErrorMessage(errors: any): string {
    if (errors.required) {
      return `${this.label} is required`;
    }
    if (errors.email) {
      return 'Please enter a valid email address';
    }
    if (errors.phone) {
      return 'Please enter a valid phone number';
    }
    if (errors.taxId) {
      return 'Please enter a valid tax ID';
    }
    if (errors.maxLength) {
      return `Maximum length is ${this.maxLength} characters`;
    }
    if (errors.pattern) {
      return 'Please enter a valid format';
    }
    if (errors.password) {
      return 'Password must be at least 12 characters and include uppercase, lowercase, number, and special character';
    }
    return 'Invalid input';
  }
}