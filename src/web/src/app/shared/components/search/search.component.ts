// @angular/core v16.x
import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy
} from '@angular/core';

// @angular/forms v16.x
import {
  FormControl,
  FormGroup,
  Validators
} from '@angular/forms';

// rxjs v7.x
import {
  Subject,
  debounceTime,
  distinctUntilChanged,
  takeUntil,
  filter
} from 'rxjs';

// Internal imports
import { InputComponent } from '../input/input.component';
import { setupFormValueChanges } from '../../utils/form.utils';

// Search configuration constants
const SEARCH_DEBOUNCE_TIME = 300;
const MAX_SEARCH_LENGTH = 100;
const SEARCH_PATTERN = /^[a-zA-Z0-9\s-_]*$/;

@Component({
  selector: 'app-search',
  template: `
    <form [formGroup]="searchForm" class="search-container" role="search">
      <app-input
        [id]="id"
        [label]="searchLabel"
        [placeholder]="placeholder"
        [maxLength]="MAX_SEARCH_LENGTH"
        [pattern]="SEARCH_PATTERN"
        [required]="false"
        [autocomplete]="'off'"
        formControlName="searchQuery"
        [ariaLabel]="ariaLabel || 'Search input'"
      ></app-input>

      <div *ngIf="showFilters" class="filter-container" role="group" [attr.aria-label]="'Search filters'">
        <div *ngFor="let filter of filterOptions" class="filter-option">
          <input
            type="checkbox"
            [id]="'filter-' + filter"
            [value]="filter"
            (change)="handleFilterChange($event)"
            [attr.aria-label]="'Filter by ' + filter"
          >
          <label [for]="'filter-' + filter">{{ filter }}</label>
        </div>
      </div>
    </form>
  `,
  styles: [`
    .search-container {
      width: 100%;
      max-width: 600px;
      margin: 0 auto;
    }

    .filter-container {
      display: flex;
      flex-wrap: wrap;
      gap: 1rem;
      margin-top: 1rem;
      padding: 0.5rem;
      border-radius: 4px;
      background-color: #f5f5f5;
    }

    .filter-option {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .filter-option input[type="checkbox"] {
      width: 18px;
      height: 18px;
      cursor: pointer;
    }

    .filter-option label {
      font-size: 0.875rem;
      color: #424242;
      cursor: pointer;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SearchComponent implements OnInit, OnDestroy {
  @Input() placeholder = 'Search...';
  @Input() searchLabel = 'Search';
  @Input() showFilters = false;
  @Input() filterOptions: string[] = [];
  @Input() ariaLabel = '';
  @Input() id = 'search-' + Math.random().toString(36).substr(2, 9);

  @Output() searchChange = new EventEmitter<string>();
  @Output() filterChange = new EventEmitter<{[key: string]: boolean}>();

  readonly MAX_SEARCH_LENGTH = MAX_SEARCH_LENGTH;
  readonly SEARCH_PATTERN = SEARCH_PATTERN;

  searchForm: FormGroup;
  private destroy$ = new Subject<void>();
  private activeFilters: {[key: string]: boolean} = {};

  constructor() {
    this.initializeSearchForm();
  }

  ngOnInit(): void {
    this.setupSearchSubscription();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initializeSearchForm(): void {
    this.searchForm = new FormGroup({
      searchQuery: new FormControl('', [
        Validators.maxLength(MAX_SEARCH_LENGTH),
        Validators.pattern(SEARCH_PATTERN)
      ])
    });
  }

  private setupSearchSubscription(): void {
    setupFormValueChanges(
      this.searchForm,
      this.destroy$,
      (values) => {
        const searchValue = values.searchQuery?.trim();
        
        // Only emit if search value is valid
        if (searchValue && this.searchForm.valid) {
          // Sanitize the search input
          const sanitizedSearch = this.sanitizeSearchInput(searchValue);
          this.searchChange.emit(sanitizedSearch);
        } else if (searchValue === '') {
          // Empty search is valid
          this.searchChange.emit('');
        }
      }
    );
  }

  private sanitizeSearchInput(value: string): string {
    // Remove any potentially harmful characters
    return value
      .replace(/[<>{}]/g, '')  // Remove potential HTML/script injection characters
      .replace(/\\/g, '')      // Remove backslashes
      .trim();
  }

  handleFilterChange(event: Event): void {
    const checkbox = event.target as HTMLInputElement;
    const filterValue = checkbox.value;
    const isChecked = checkbox.checked;

    // Update active filters
    this.activeFilters[filterValue] = isChecked;

    // Emit updated filter state
    this.filterChange.emit({...this.activeFilters});

    // Update ARIA attributes for accessibility
    checkbox.setAttribute('aria-checked', isChecked.toString());
  }
}