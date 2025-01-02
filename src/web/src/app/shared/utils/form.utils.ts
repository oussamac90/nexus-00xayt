// @angular/forms v16.x
import {
  FormGroup,
  FormControl,
  AbstractControl,
  ValidationErrors
} from '@angular/forms';

// rxjs v7.x
import {
  Observable,
  Subject,
  Subscription
} from 'rxjs';
import {
  debounceTime,
  takeUntil,
  distinctUntilChanged
} from 'rxjs/operators';

/**
 * Default debounce time for form value changes in milliseconds
 */
export const FORM_DEBOUNCE_TIME = 300;

/**
 * Interface for structured validation error collection
 */
interface ValidationErrorMap {
  [key: string]: {
    control: string;
    errors: ValidationErrors;
    timestamp: number;
    path: string[];
  };
}

/**
 * Recursively marks all controls in a form group as touched to trigger validation visualization
 * Updates ARIA attributes for accessibility compliance
 * 
 * @param formGroup - The Angular FormGroup to process
 */
export function markFormGroupTouched(formGroup: FormGroup): void {
  Object.values(formGroup.controls).forEach(control => {
    if (control instanceof FormGroup) {
      markFormGroupTouched(control);
    } else {
      control.markAsTouched();
      
      // Update ARIA attributes for accessibility
      const element = control.get('nativeElement');
      if (element) {
        element.setAttribute('aria-invalid', control.invalid ? 'true' : 'false');
        if (control.errors) {
          element.setAttribute('aria-errormessage', 
            Object.keys(control.errors).join(', '));
        }
      }
    }
  });
}

/**
 * Resets form to initial state with comprehensive cleanup
 * Handles nested form groups and accessibility attributes
 * 
 * @param formGroup - The Angular FormGroup to reset
 * @param initialValues - Optional initial values to reset the form to
 */
export function resetForm(formGroup: FormGroup, initialValues?: object): void {
  // Reset form with optional initial values
  formGroup.reset(initialValues || {});
  
  // Clear validation states
  Object.values(formGroup.controls).forEach(control => {
    control.setErrors(null);
    control.markAsPristine();
    control.markAsUntouched();
    
    // Handle nested form groups
    if (control instanceof FormGroup) {
      resetForm(control);
    }
    
    // Reset ARIA attributes
    const element = control.get('nativeElement');
    if (element) {
      element.removeAttribute('aria-invalid');
      element.removeAttribute('aria-errormessage');
    }
  });
}

/**
 * Retrieves all validation errors from a form group with detailed error information
 * Includes control paths and timestamps for error tracking
 * 
 * @param formGroup - The Angular FormGroup to get errors from
 * @returns Object containing validation errors mapped by control path
 */
export function getFormValidationErrors(formGroup: FormGroup): ValidationErrorMap {
  const errors: ValidationErrorMap = {};
  
  function collectErrors(control: AbstractControl, path: string[] = []): void {
    if (control instanceof FormGroup) {
      Object.keys(control.controls).forEach(key => {
        collectErrors(control.get(key)!, [...path, key]);
      });
    } else if (control.errors) {
      const controlPath = path.join('.');
      errors[controlPath] = {
        control: path[path.length - 1],
        errors: control.errors,
        timestamp: Date.now(),
        path: path
      };
    }
  }
  
  collectErrors(formGroup);
  return errors;
}

/**
 * Sets up subscription for form value changes with debounce and cleanup
 * Includes error handling and automatic unsubscription
 * 
 * @param formGroup - The Angular FormGroup to monitor
 * @param destroy$ - Subject for cleanup on component destruction
 * @param callback - Function to execute when form values change
 * @returns RxJS Subscription for manual cleanup if needed
 */
export function setupFormValueChanges(
  formGroup: FormGroup,
  destroy$: Subject<void>,
  callback: (values: any) => void
): Subscription {
  return formGroup.valueChanges.pipe(
    debounceTime(FORM_DEBOUNCE_TIME),
    distinctUntilChanged((prev, curr) => JSON.stringify(prev) === JSON.stringify(curr)),
    takeUntil(destroy$)
  ).subscribe({
    next: (values) => {
      try {
        callback(values);
      } catch (error) {
        console.error('Error in form value changes callback:', error);
      }
    },
    error: (error) => {
      console.error('Error in form value changes subscription:', error);
    }
  });
}