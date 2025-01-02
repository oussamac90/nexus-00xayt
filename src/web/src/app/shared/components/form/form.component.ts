// @angular/core v16.x
import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
  ChangeDetectorRef
} from '@angular/core';

// @angular/forms v16.x
import {
  FormGroup,
  FormBuilder,
  AbstractControl,
  ValidationErrors
} from '@angular/forms';

// rxjs v7.x
import {
  Subject,
  takeUntil,
  debounceTime,
  distinctUntilChanged,
  shareReplay
} from 'rxjs';

// Internal components and utilities
import { InputComponent } from '../input/input.component';
import {
  markFormGroupTouched,
  resetForm,
  getFormValidationErrors,
  setupFormValueChanges,
  validateFormSecurity,
  cacheFormValidation
} from '../../utils/form.utils';

// Constants for form configuration
const FORM_SUBMIT_DEBOUNCE = 500;
const FORM_VALIDATION_CACHE_SIZE = 10;
const FORM_SECURITY_CONFIG = {
  maxLength: 1000,
  allowedTags: ['p', 'br'],
  sanitize: true
};

@Component({
  selector: 'app-form',
  template: `
    <form
      [formGroup]="formGroup"
      (ngSubmit)="handleSubmit($event)"
      [attr.aria-label]="formGroup.get('formTitle')?.value || 'Form'"
      class="form-container"
      novalidate>
      
      <div class="form-content">
        <ng-content></ng-content>
      </div>

      <div class="form-actions">
        <button
          type="submit"
          class="submit-button"
          [disabled]="formGroup.invalid || loading"
          [attr.aria-busy]="loading">
          <span class="button-text">{{ submitButtonText }}</span>
          <span *ngIf="loading" class="loading-indicator" aria-hidden="true"></span>
        </button>

        <button
          *ngIf="showResetButton"
          type="button"
          class="reset-button"
          (click)="resetFormData()"
          [disabled]="loading">
          Reset
        </button>
      </div>

      <div
        *ngIf="formGroup.errors"
        class="form-error"
        role="alert"
        [attr.aria-live]="ariaLiveRegion">
        {{ getFormErrorMessage(formGroup.errors) }}
      </div>
    </form>
  `,
  styles: [`
    .form-container {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
      width: 100%;
      max-width: 600px;
      margin: 0 auto;
      padding: 1.5rem;
    }

    .form-content {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .form-actions {
      display: flex;
      gap: 1rem;
      margin-top: 1rem;
    }

    .submit-button,
    .reset-button {
      padding: 0.75rem 1.5rem;
      border-radius: 4px;
      font-weight: 500;
      transition: all 0.2s ease;
    }

    .submit-button {
      background-color: #1976D2;
      color: white;
      border: none;
    }

    .submit-button:disabled {
      background-color: #BDBDBD;
      cursor: not-allowed;
    }

    .reset-button {
      background-color: transparent;
      border: 1px solid #424242;
      color: #424242;
    }

    .loading-indicator {
      display: inline-block;
      width: 1rem;
      height: 1rem;
      margin-left: 0.5rem;
      border: 2px solid rgba(255,255,255,0.3);
      border-radius: 50%;
      border-top-color: white;
      animation: spin 1s linear infinite;
    }

    .form-error {
      color: #D32F2F;
      font-size: 0.875rem;
      margin-top: 0.5rem;
      padding: 0.5rem;
      border-radius: 4px;
      background-color: rgba(211, 47, 47, 0.1);
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FormComponent implements OnInit, OnDestroy {
  @Input() formGroup!: FormGroup;
  @Input() submitButtonText = 'Submit';
  @Input() showResetButton = false;
  @Input() loading = false;

  @Output() formSubmit = new EventEmitter<any>();
  @Output() formReset = new EventEmitter<void>();

  private destroy$ = new Subject<void>();
  private validationCache = new Map<string, ValidationErrors>();
  private isSecurityValidated = false;
  ariaLiveRegion = 'polite';

  constructor(
    private formBuilder: FormBuilder,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.setupFormValidation();
    this.setupSecurityValidation();
    this.setupAccessibility();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.validationCache.clear();
  }

  handleSubmit(event: Event): void {
    event.preventDefault();

    if (this.loading) {
      return;
    }

    markFormGroupTouched(this.formGroup);

    if (!this.isSecurityValidated) {
      const securityValidation = this.validateFormSecurity();
      if (!securityValidation.valid) {
        this.formGroup.setErrors({ security: securityValidation.errors });
        this.cdr.markForCheck();
        return;
      }
    }

    if (this.formGroup.valid) {
      const formValue = this.sanitizeFormData(this.formGroup.value);
      this.formSubmit.emit(formValue);
    } else {
      this.handleValidationErrors();
    }
  }

  resetFormData(): void {
    resetForm(this.formGroup);
    this.validationCache.clear();
    this.isSecurityValidated = false;
    this.formReset.emit();
    this.cdr.markForCheck();
  }

  private setupFormValidation(): void {
    setupFormValueChanges(
      this.formGroup,
      this.destroy$,
      (values) => {
        this.validateForm(values);
      }
    );
  }

  private setupSecurityValidation(): void {
    this.formGroup.valueChanges.pipe(
      debounceTime(FORM_SUBMIT_DEBOUNCE),
      distinctUntilChanged(),
      takeUntil(this.destroy$),
      shareReplay(1)
    ).subscribe(() => {
      this.isSecurityValidated = false;
    });
  }

  private setupAccessibility(): void {
    this.formGroup.statusChanges.pipe(
      takeUntil(this.destroy$)
    ).subscribe(status => {
      this.ariaLiveRegion = status === 'INVALID' ? 'assertive' : 'polite';
      this.cdr.markForCheck();
    });
  }

  private validateForm(values: any): void {
    const errors = getFormValidationErrors(this.formGroup);
    this.validationCache = this.updateValidationCache(errors);
    this.cdr.markForCheck();
  }

  private validateFormSecurity(): { valid: boolean; errors?: string[] } {
    // Implement security validation logic here
    return { valid: true };
  }

  private sanitizeFormData(data: any): any {
    // Implement data sanitization logic here
    return data;
  }

  private handleValidationErrors(): void {
    const errors = getFormValidationErrors(this.formGroup);
    this.validationCache = this.updateValidationCache(errors);
    this.cdr.markForCheck();
  }

  private updateValidationCache(errors: ValidationErrors): Map<string, ValidationErrors> {
    const cache = new Map(this.validationCache);
    
    if (cache.size >= FORM_VALIDATION_CACHE_SIZE) {
      const firstKey = cache.keys().next().value;
      cache.delete(firstKey);
    }

    cache.set(Date.now().toString(), errors);
    return cache;
  }

  private getFormErrorMessage(errors: ValidationErrors): string {
    if (errors.security) {
      return 'Form contains security violations. Please check your input.';
    }
    return 'Please correct the errors in the form before submitting.';
  }
}