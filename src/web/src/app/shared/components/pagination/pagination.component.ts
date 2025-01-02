// Angular Material Paginator v16.x
import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  OnChanges,
  SimpleChanges,
  ChangeDetectionStrategy
} from '@angular/core';

// Angular Material Paginator v16.x
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';

/**
 * A reusable pagination component implementing Material Design standards
 * for consistent pagination controls across the Nexus Platform.
 */
@Component({
  selector: 'app-pagination',
  templateUrl: './pagination.component.html',
  styleUrls: ['./pagination.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [MatPaginatorModule]
})
export class PaginationComponent implements OnInit, OnChanges {
  /**
   * Number of items to display per page
   * @default 10
   */
  @Input() pageSize: number = 10;

  /**
   * Total number of items in the dataset
   * @default 0
   */
  @Input() totalItems: number = 0;

  /**
   * Current active page index (zero-based)
   * @default 0
   */
  @Input() currentPage: number = 0;

  /**
   * Available page size options for user selection
   * @default [5, 10, 25, 50]
   */
  @Input() pageSizeOptions: number[] = [5, 10, 25, 50];

  /**
   * Whether to show first/last page navigation buttons
   * @default true
   */
  @Input() showFirstLastButtons: boolean = true;

  /**
   * Event emitter for pagination changes
   * Emits PageEvent containing updated pagination state
   */
  @Output() pageChange = new EventEmitter<PageEvent>();

  // Internal state tracking
  private _initialized: boolean = false;
  private _lastPageIndex: number = 0;
  private _lastPageSize: number = 10;

  constructor() {}

  /**
   * Initialize component with validation of initial configuration
   */
  ngOnInit(): void {
    // Validate page size against options
    if (!this.pageSizeOptions.includes(this.pageSize)) {
      console.warn('Invalid page size. Defaulting to first available option.');
      this.pageSize = this.pageSizeOptions[0];
    }

    // Ensure page size options are sorted
    this.pageSizeOptions.sort((a, b) => a - b);

    // Validate total items
    if (this.totalItems < 0) {
      console.warn('Invalid total items count. Defaulting to 0.');
      this.totalItems = 0;
    }

    // Calculate initial page boundaries
    this._lastPageIndex = Math.max(0, Math.ceil(this.totalItems / this.pageSize) - 1);
    this.currentPage = Math.min(this.currentPage, this._lastPageIndex);

    // Mark as initialized
    this._initialized = true;

    // Emit initial configuration
    this.emitPageEvent();
  }

  /**
   * Handle changes to input properties
   */
  ngOnChanges(changes: SimpleChanges): void {
    if (!this._initialized) {
      return;
    }

    let requiresUpdate = false;

    // Handle totalItems changes
    if (changes['totalItems']) {
      this.totalItems = Math.max(0, changes['totalItems'].currentValue);
      requiresUpdate = true;
    }

    // Handle pageSize changes
    if (changes['pageSize']) {
      const newPageSize = changes['pageSize'].currentValue;
      if (this.pageSizeOptions.includes(newPageSize)) {
        this.pageSize = newPageSize;
        requiresUpdate = true;
      }
    }

    // Handle pageSizeOptions changes
    if (changes['pageSizeOptions']) {
      this.pageSizeOptions = [...changes['pageSizeOptions'].currentValue].sort((a, b) => a - b);
      if (!this.pageSizeOptions.includes(this.pageSize)) {
        this.pageSize = this.pageSizeOptions[0];
        requiresUpdate = true;
      }
    }

    // Update pagination if needed
    if (requiresUpdate) {
      this.updatePagination(this.pageSize, this.currentPage);
    }
  }

  /**
   * Handle page change events from Material paginator
   */
  onPageChange(event: PageEvent): void {
    this.updatePagination(event.pageSize, event.pageIndex);
  }

  /**
   * Update pagination configuration with validation
   */
  private updatePagination(newPageSize: number, newPageIndex: number): void {
    // Update page size
    this.pageSize = newPageSize;
    this._lastPageSize = newPageSize;

    // Calculate max page index
    const maxPageIndex = Math.max(0, Math.ceil(this.totalItems / this.pageSize) - 1);

    // Ensure page index is within bounds
    this.currentPage = Math.min(newPageIndex, maxPageIndex);
    this._lastPageIndex = this.currentPage;

    // Emit updated configuration
    this.emitPageEvent();
  }

  /**
   * Emit page change event with current configuration
   */
  private emitPageEvent(): void {
    const event: PageEvent = {
      pageIndex: this.currentPage,
      pageSize: this.pageSize,
      length: this.totalItems,
      previousPageIndex: this._lastPageIndex
    };

    this.pageChange.emit(event);
  }
}