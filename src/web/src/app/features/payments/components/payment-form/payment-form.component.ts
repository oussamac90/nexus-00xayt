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
  FormBuilder, 
  FormGroup, 
  Validators, 
  AbstractControl 
} from '@angular/forms';

// rxjs v7.x
import { 
  Subject, 
  BehaviorSubject, 
  Observable 
} from 'rxjs';
import { 
  takeUntil, 
  debounceTime 
} from 'rxjs/operators';
import { 
  catchError, 
  finalize, 
  retry, 
  map 
} from 'rxjs/operators';

import { PaymentsApiService } from '../../services/payments-api.service';

// Regular expressions for card validation
const CARD_NUMBER_PATTERN = /^(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|3(?:0[0-5]|[68][0-9])[0-9]{11}|6(?:011|5[0-9]{2})[0-9]{12}|(?:2131|1800|35\d{3})\d{11})$/;
const CVV_PATTERN = /^([0-9]{3,4})$/;
const EXPIRY_PATTERN = /^(0[1-9]|1[0-2])\/([0-9]{2})$/;
const RETRY_CONFIG = { count: 3, delay: 1000 };

// Types
interface PaymentAmount {
  value: number;
  currency: string;
}

interface PaymentError {
  code: string;
  message: string;
  details?: any;
}

interface PaymentResult {
  transactionId: string;
  status: 'success' | 'failed';
  timestamp: string;
}

type CardType = 'visa' | 'mastercard' | 'amex' | 'discover' | 'unknown';

@Component({
  selector: 'app-secure-payment-form',
  templateUrl: './payment-form.component.html',
  styleUrls: ['./payment-form.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SecurePaymentFormComponent implements OnInit, OnDestroy {
  @Input() loading = false;
  @Input() orderId!: string;
  @Input() amount!: PaymentAmount;
  @Output() paymentComplete = new EventEmitter<PaymentResult>();
  @Output() paymentError = new EventEmitter<PaymentError>();

  securePaymentForm!: FormGroup;
  cardType$ = new BehaviorSubject<CardType>('unknown');
  private destroy$ = new Subject<void>();
  private processingPayment = false;

  constructor(
    private formBuilder: FormBuilder,
    private paymentsService: PaymentsApiService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.initializeSecureForm();
    this.setupCardValidation();
    this.setupFormSubscriptions();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.securelyDestroyForm();
  }

  private initializeSecureForm(): void {
    this.securePaymentForm = this.formBuilder.group({
      cardHolder: ['', [
        Validators.required,
        Validators.minLength(3),
        Validators.maxLength(100),
        Validators.pattern(/^[a-zA-Z\s-']+$/)
      ]],
      cardNumber: ['', [
        Validators.required,
        Validators.pattern(CARD_NUMBER_PATTERN),
        this.luhnValidator
      ]],
      expiryDate: ['', [
        Validators.required,
        Validators.pattern(EXPIRY_PATTERN),
        this.expiryValidator
      ]],
      cvv: ['', [
        Validators.required,
        Validators.pattern(CVV_PATTERN)
      ]],
      saveCard: [false]
    });
  }

  private setupCardValidation(): void {
    this.securePaymentForm.get('cardNumber')?.valueChanges
      .pipe(
        debounceTime(300),
        takeUntil(this.destroy$)
      )
      .subscribe(value => {
        if (value) {
          this.cardType$.next(this.detectCardType(value));
        }
      });
  }

  private setupFormSubscriptions(): void {
    // Monitor form changes for fraud detection
    this.securePaymentForm.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.detectSuspiciousActivity();
      });
  }

  async processSecurePayment(event: Event): Promise<void> {
    event.preventDefault();
    
    if (this.processingPayment || this.securePaymentForm.invalid) {
      return;
    }

    this.processingPayment = true;
    this.loading = true;
    this.cdr.markForCheck();

    try {
      const formData = this.securePaymentForm.value;
      
      // Tokenize card data before transmission
      const paymentToken = await this.paymentsService.tokenizeCard({
        cardNumber: this.maskCardNumber(formData.cardNumber),
        expiryDate: formData.expiryDate,
        cvv: formData.cvv
      }).toPromise();

      const paymentRequest = {
        amount: this.amount.value,
        currency: this.amount.currency,
        orderId: this.orderId,
        paymentMethod: {
          type: this.cardType$.value,
          token: paymentToken
        }
      };

      this.paymentsService.processPayment(paymentRequest)
        .pipe(
          retry(RETRY_CONFIG),
          finalize(() => {
            this.processingPayment = false;
            this.loading = false;
            this.cdr.markForCheck();
          }),
          takeUntil(this.destroy$)
        )
        .subscribe({
          next: (result) => {
            this.paymentComplete.emit({
              transactionId: result.id,
              status: result.status === 'completed' ? 'success' : 'failed',
              timestamp: result.createdAt
            });
            this.securelyResetForm();
          },
          error: (error) => {
            this.paymentError.emit({
              code: error.error,
              message: error.message,
              details: error.details
            });
          }
        });
    } catch (error) {
      this.processingPayment = false;
      this.loading = false;
      this.paymentError.emit({
        code: 'TOKENIZATION_ERROR',
        message: 'Failed to secure payment data'
      });
      this.cdr.markForCheck();
    }
  }

  private luhnValidator(control: AbstractControl): {[key: string]: boolean} | null {
    if (!control.value) {
      return null;
    }

    const value = control.value.replace(/\D/g, '');
    let sum = 0;
    let isEven = false;

    for (let i = value.length - 1; i >= 0; i--) {
      let digit = parseInt(value.charAt(i), 10);

      if (isEven) {
        digit *= 2;
        if (digit > 9) {
          digit -= 9;
        }
      }

      sum += digit;
      isEven = !isEven;
    }

    return (sum % 10 === 0) ? null : { 'luhn': true };
  }

  private expiryValidator(control: AbstractControl): {[key: string]: boolean} | null {
    if (!control.value) {
      return null;
    }

    const [month, year] = control.value.split('/');
    const expiry = new Date(2000 + parseInt(year, 10), parseInt(month, 10) - 1);
    const today = new Date();

    return expiry > today ? null : { 'expired': true };
  }

  private detectCardType(cardNumber: string): CardType {
    const cleaned = cardNumber.replace(/\D/g, '');
    if (/^4/.test(cleaned)) return 'visa';
    if (/^5[1-5]/.test(cleaned)) return 'mastercard';
    if (/^3[47]/.test(cleaned)) return 'amex';
    if (/^6(?:011|5)/.test(cleaned)) return 'discover';
    return 'unknown';
  }

  private maskCardNumber(cardNumber: string): string {
    const cleaned = cardNumber.replace(/\D/g, '');
    return cleaned.replace(/(\d{4})/g, '$1 ').trim();
  }

  private detectSuspiciousActivity(): void {
    const formValue = this.securePaymentForm.value;
    const suspiciousPatterns = [
      /^4242/, // Test card numbers
      /0000$/, // Sequential digits
      /1234/   // Sequential digits
    ];

    const isSuspicious = suspiciousPatterns.some(pattern => 
      pattern.test(formValue.cardNumber)
    );

    if (isSuspicious) {
      console.warn('Suspicious payment activity detected');
      // Implement additional fraud detection logic here
    }
  }

  private securelyResetForm(): void {
    this.securePaymentForm.reset();
    Object.keys(this.securePaymentForm.controls).forEach(key => {
      const control = this.securePaymentForm.get(key);
      control?.setErrors(null);
    });
  }

  private securelyDestroyForm(): void {
    if (this.securePaymentForm) {
      this.securePaymentForm.reset();
      Object.keys(this.securePaymentForm.controls).forEach(key => {
        const control = this.securePaymentForm.get(key);
        control?.setErrors(null);
      });
    }
    this.cardType$.complete();
  }
}