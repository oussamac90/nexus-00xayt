// Angular Core v16.x
import {
  Component,
  OnInit,
  OnDestroy,
  ViewChild,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  EventEmitter,
  Output
} from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';

// RxJS v7.x
import { Subject, BehaviorSubject } from 'rxjs';
import { takeUntil, debounceTime, distinctUntilChanged } from 'rxjs/operators';

// Angular Material v16.x
import { MatSnackBar } from '@angular/material/snack-bar';

// Internal Imports
import { ShippingApiService } from '../../services/shipping-api.service';
import { DataGridComponent } from '../../../../shared/components/data-grid/data-grid.component';
import { FormUtils } from '../../../../shared/utils/form.utils';

// Constants
const DEBOUNCE_TIME = 500;
const RATE_COLUMNS = [
  { key: 'carrier', header: 'Carrier', sortable: true },
  { key: 'service', header: 'Service Type', sortable: true },
  { key: 'rate', header: 'Rate', sortable: true, type: 'number' },
  { key: 'transitTime', header: 'Transit Time', sortable: true },
  { key: 'guaranteed', header: 'Guaranteed', type: 'boolean' }
];

interface ShippingRate {
  id: string;
  carrier: string;
  service: string;
  rate: number;
  transitTime: string;
  guaranteed: boolean;
  estimatedDelivery: Date;
}

@Component({
  selector: 'app-shipping-rates',
  templateUrl: './shipping-rates.component.html',
  styleUrls: ['./shipping-rates.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ShippingRatesComponent implements OnInit, OnDestroy {
  // ViewChild References
  @ViewChild(DataGridComponent) ratesGrid!: DataGridComponent;

  // Output Events
  @Output() rateSelected = new EventEmitter<ShippingRate>();

  // Public Properties
  shippingForm: FormGroup;
  shippingRates: ShippingRate[] = [];
  isLoading = false;
  errors: string[] = [];
  columns = RATE_COLUMNS;

  // Private Properties
  private destroy$ = new Subject<void>();
  private isCalculating$ = new BehaviorSubject<boolean>(false);

  constructor(
    private formBuilder: FormBuilder,
    private shippingService: ShippingApiService,
    private snackBar: MatSnackBar,
    private cdr: ChangeDetectorRef
  ) {
    this.initializeForm();
  }

  ngOnInit(): void {
    this.setupFormSubscription();
    this.setupAccessibility();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initializeForm(): void {
    this.shippingForm = this.formBuilder.group({
      origin: this.formBuilder.group({
        street: ['', Validators.required],
        city: ['', Validators.required],
        state: ['', Validators.required],
        country: ['', Validators.required],
        postalCode: ['', [Validators.required, Validators.pattern('^[0-9]{5}(?:-[0-9]{4})?$')]]
      }),
      destination: this.formBuilder.group({
        street: ['', Validators.required],
        city: ['', Validators.required],
        state: ['', Validators.required],
        country: ['', Validators.required],
        postalCode: ['', [Validators.required, Validators.pattern('^[0-9]{5}(?:-[0-9]{4})?$')]]
      }),
      package: this.formBuilder.group({
        weight: ['', [Validators.required, Validators.min(0.1)]],
        length: ['', [Validators.required, Validators.min(1)]],
        width: ['', [Validators.required, Validators.min(1)]],
        height: ['', [Validators.required, Validators.min(1)]],
        insurance: [false],
        insuranceValue: [{ value: '', disabled: true }]
      })
    });

    // Enable/disable insurance value based on insurance checkbox
    this.shippingForm.get('package.insurance')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(checked => {
        const insuranceValueControl = this.shippingForm.get('package.insuranceValue');
        if (checked) {
          insuranceValueControl?.enable();
          insuranceValueControl?.setValidators([Validators.required, Validators.min(0)]);
        } else {
          insuranceValueControl?.disable();
          insuranceValueControl?.clearValidators();
        }
        insuranceValueControl?.updateValueAndValidity();
      });
  }

  private setupFormSubscription(): void {
    FormUtils.setupFormValueChanges(
      this.shippingForm,
      this.destroy$,
      async (values) => {
        if (this.shippingForm.valid && !this.isCalculating$.value) {
          await this.calculateRates(values);
        }
      }
    );
  }

  private setupAccessibility(): void {
    const form = document.querySelector('form');
    if (form) {
      form.setAttribute('role', 'form');
      form.setAttribute('aria-label', 'Shipping Rate Calculator');
    }
  }

  async calculateRates(formData: any): Promise<void> {
    try {
      this.isCalculating$.next(true);
      this.isLoading = true;
      this.errors = [];
      this.cdr.markForCheck();

      // Validate addresses first
      const originValid = await this.shippingService.validateAddress(formData.origin).toPromise();
      const destValid = await this.shippingService.validateAddress(formData.destination).toPromise();

      if (!originValid || !destValid) {
        throw new Error('One or more addresses are invalid');
      }

      const rates = await this.shippingService.calculateRates({
        origin: formData.origin,
        destination: formData.destination,
        package: {
          weight: {
            value: formData.package.weight,
            unit: 'lb'
          },
          dimensions: {
            length: formData.package.length,
            width: formData.package.width,
            height: formData.package.height,
            unit: 'in'
          },
          insurance: formData.package.insurance ? {
            value: formData.package.insuranceValue,
            currency: 'USD'
          } : undefined
        }
      }).toPromise();

      this.shippingRates = rates;
      this.ratesGrid?.refreshData(rates);
      
      this.snackBar.open('Shipping rates updated successfully', 'Close', {
        duration: 3000,
        horizontalPosition: 'right'
      });

    } catch (error: any) {
      this.errors.push(error.message || 'Failed to calculate shipping rates');
      this.snackBar.open('Error calculating shipping rates', 'Close', {
        duration: 5000,
        horizontalPosition: 'right',
        panelClass: ['error-snackbar']
      });
    } finally {
      this.isLoading = false;
      this.isCalculating$.next(false);
      this.cdr.markForCheck();
    }
  }

  onRateSelect(rate: ShippingRate): void {
    if (!this.isLoading) {
      this.shippingService.selectRate(rate.id)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (selectedRate) => {
            this.rateSelected.emit(selectedRate);
            this.snackBar.open('Shipping rate selected successfully', 'Close', {
              duration: 3000
            });
          },
          error: (error) => {
            this.snackBar.open('Error selecting shipping rate', 'Close', {
              duration: 5000,
              panelClass: ['error-snackbar']
            });
          }
        });
    }
  }

  resetForm(): void {
    FormUtils.resetForm(this.shippingForm);
    this.shippingRates = [];
    this.errors = [];
    this.cdr.markForCheck();
  }
}