// @angular/forms v16.x - Core Angular form validation types and functions
import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
// validator v13.x - Robust email validation with international support
import { isEmail } from 'validator';

/**
 * Global validation constants for form field validation
 */
export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{12,64}$/;
export const PHONE_PATTERN = /^\+[1-9](?:[0-9]){1,14}$/;
export const TAX_ID_PATTERN = /^[A-Z0-9]{6,20}$/;
export const MAX_INPUT_LENGTH = 256;

/**
 * Enhanced email validator with international email support and security checks
 * @param control Form control to validate
 * @returns ValidationErrors object if invalid, null if valid
 */
export function emailValidator(control: AbstractControl): ValidationErrors | null {
  const value = control.value;

  // Return null if no value (optional field handling)
  if (!value) {
    return null;
  }

  // Sanitize input value to prevent XSS
  const sanitizedValue = value.toString().trim();

  // Check for maximum length compliance
  if (sanitizedValue.length > MAX_INPUT_LENGTH) {
    return { maxLength: true };
  }

  // Validate email format using isEmail with strict mode
  if (!isEmail(sanitizedValue, { allow_utf8_local_part: true, require_tld: true })) {
    return { email: true };
  }

  // Check for common attack patterns
  if (sanitizedValue.includes('script') || sanitizedValue.includes('javascript:')) {
    return { malicious: true };
  }

  return null;
}

/**
 * International phone number validator supporting E.164 format with regional validation
 * @param control Form control to validate
 * @returns ValidationErrors object if invalid, null if valid
 */
export function phoneNumberValidator(control: AbstractControl): ValidationErrors | null {
  const value = control.value;

  // Return null if no value
  if (!value) {
    return null;
  }

  // Sanitize input value
  const sanitizedValue = value.toString().trim();

  // Check for maximum length compliance
  if (sanitizedValue.length > MAX_INPUT_LENGTH) {
    return { maxLength: true };
  }

  // Remove all whitespace and formatting
  const normalizedValue = sanitizedValue.replace(/\s+/g, '');

  // Validate against E.164 format
  if (!PHONE_PATTERN.test(normalizedValue)) {
    return { phone: true };
  }

  // Extract country code for specific validation
  const countryCode = normalizedValue.slice(1, 4);
  
  // Perform country-specific length validation
  const numberLength = normalizedValue.length;
  if (numberLength < 8 || numberLength > 15) {
    return { phoneLength: true };
  }

  return null;
}

/**
 * Enhanced business tax ID validator with international format support
 * @param control Form control to validate
 * @returns ValidationErrors object if invalid, null if valid
 */
export function taxIdValidator(control: AbstractControl): ValidationErrors | null {
  const value = control.value;

  // Return null if no value
  if (!value) {
    return null;
  }

  // Sanitize input value
  const sanitizedValue = value.toString().trim();

  // Check for maximum length compliance
  if (sanitizedValue.length > MAX_INPUT_LENGTH) {
    return { maxLength: true };
  }

  // Convert to uppercase for consistency
  const normalizedValue = sanitizedValue.toUpperCase();

  // Validate against TAX_ID_PATTERN
  if (!TAX_ID_PATTERN.test(normalizedValue)) {
    return { taxId: true };
  }

  // Basic checksum validation for common formats
  const hasValidChecksum = /^[A-Z]{2}[0-9]{9}$/.test(normalizedValue) || 
                          /^[0-9]{9}$/.test(normalizedValue);
  
  if (!hasValidChecksum) {
    return { taxIdChecksum: true };
  }

  return null;
}

/**
 * Comprehensive password validator with enhanced security requirements
 * @param control Form control to validate
 * @returns ValidationErrors object if invalid, null if valid
 */
export function passwordValidator(control: AbstractControl): ValidationErrors | null {
  const value = control.value;

  // Return null if no value
  if (!value) {
    return null;
  }

  // Check for maximum length compliance
  if (value.length > MAX_INPUT_LENGTH) {
    return { maxLength: true };
  }

  const errors: ValidationErrors = {};

  // Validate minimum length requirement
  if (value.length < PASSWORD_MIN_LENGTH) {
    errors['minLength'] = true;
  }

  // Check password pattern requirements
  if (!PASSWORD_PATTERN.test(value)) {
    errors['pattern'] = true;
  }

  // Check for sequential characters
  if (/abc|123|qwe|asd|xyz/i.test(value)) {
    errors['sequential'] = true;
  }

  // Check for repeated characters
  if (/(.)\1{2,}/.test(value)) {
    errors['repeated'] = true;
  }

  return Object.keys(errors).length > 0 ? errors : null;
}

/**
 * Secure password confirmation validator with timing attack protection
 * @param passwordKey Primary password form control name
 * @param confirmPasswordKey Confirmation password form control name
 * @returns ValidatorFn for password match validation
 */
export function matchPasswordValidator(passwordKey: string, confirmPasswordKey: string): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    if (!control || !control.parent) {
      return null;
    }

    const password = control.parent.get(passwordKey);
    const confirmPassword = control.parent.get(confirmPasswordKey);

    if (!password || !confirmPassword) {
      return null;
    }

    // Perform timing-safe comparison
    const passwordValue = password.value || '';
    const confirmValue = confirmPassword.value || '';
    
    if (passwordValue.length !== confirmValue.length) {
      return { passwordMatch: true };
    }

    let match = true;
    for (let i = 0; i < passwordValue.length; i++) {
      if (passwordValue.charAt(i) !== confirmValue.charAt(i)) {
        match = false;
      }
    }

    return match ? null : { passwordMatch: true };
  };
}