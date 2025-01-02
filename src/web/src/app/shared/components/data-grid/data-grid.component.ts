// Angular Core v16.x
import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
  ViewChild,
  ContentChildren,
  QueryList,
  ChangeDetectorRef
} from '@angular/core';

// Angular Material v16.x
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatSortModule, MatSort, Sort } from '@angular/material/sort';
import { MatCheckboxModule } from '@angular/material/checkbox';

// RxJS v7.x
import { Subject, Subscription } from 'rxjs';
import { takeUntil, debounceTime } from 'rxjs/operators';

// Internal Imports
import { PaginationComponent } from '../pagination/pagination.component';
import { handleApiError } from '../../utils/api.utils';

// Types
interface ColumnDefinition {
  key: string;
  header: string;
  sortable?: boolean;
  type?: 'text' | 'number' | 'date' | 'boolean' | 'custom';
  width?: string;
  visible?: boolean;
  template?: any;
  formatter?: (value: any) => string;
}

interface GridState {
  sort?: Sort;
  pageIndex: number;
  pageSize: number;
  selection: Set<string>;
}

@Component({
  selector: 'app-data-grid',
  templateUrl: './data-grid.component.html',
  styleUrls: ['./data-grid.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    MatTableModule,
    MatSortModule,
    MatCheckboxModule,
    PaginationComponent
  ]
})
export class DataGridComponent implements OnInit, OnDestroy {
  // Inputs
  @Input() data: any[] = [];
  @Input() columns: ColumnDefinition[] = [];
  @Input() selectable: boolean = false;
  @Input() pageSize: number = 10;
  @Input() totalItems: number = 0;
  @Input() loading: boolean = false;
  @Input() serverSide: boolean = true;
  @Input() uniqueKey: string = 'id';

  // Outputs
  @Output() sortChange = new EventEmitter<Sort>();
  @Output() pageChange = new EventEmitter<{ pageIndex: number; pageSize: number }>();
  @Output() selectionChange = new EventEmitter<any[]>();
  @Output() rowClick = new EventEmitter<any>();
  @Output() error = new EventEmitter<any>();

  // ViewChild References
  @ViewChild(MatSort) sort!: MatSort;
  @ViewChild(PaginationComponent) paginator!: PaginationComponent;
  @ContentChildren('columnTemplate') columnTemplates!: QueryList<any>;

  // Public Properties
  dataSource: MatTableDataSource<any>;
  displayedColumns: string[] = [];
  selectedItems: Set<string> = new Set();
  
  // Private Properties
  private destroy$ = new Subject<void>();
  private sortSubscription?: Subscription;
  private gridState: GridState = {
    pageIndex: 0,
    pageSize: 10,
    selection: new Set()
  };

  constructor(private cdr: ChangeDetectorRef) {
    this.dataSource = new MatTableDataSource<any>([]);
  }

  ngOnInit(): void {
    this.initializeGrid();
    this.setupSortingAndPagination();
    this.setupResponsiveColumns();
    this.setupAccessibility();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.sortSubscription) {
      this.sortSubscription.unsubscribe();
    }
  }

  private initializeGrid(): void {
    // Initialize data source with configuration
    this.dataSource.data = this.data;
    this.gridState.pageSize = this.pageSize;

    // Configure displayed columns
    this.displayedColumns = this.selectable ? ['select', ...this.columns.map(c => c.key)] : this.columns.map(c => c.key);

    // Initialize selection if enabled
    if (this.selectable) {
      this.selectedItems = new Set<string>();
    }
  }

  private setupSortingAndPagination(): void {
    // Configure server-side sorting
    if (this.serverSide) {
      this.sortSubscription = this.sort.sortChange
        .pipe(
          takeUntil(this.destroy$),
          debounceTime(300)
        )
        .subscribe((sortEvent: Sort) => {
          this.onSort(sortEvent);
        });
    } else {
      this.dataSource.sort = this.sort;
    }
  }

  private setupResponsiveColumns(): void {
    // Handle responsive column visibility
    this.columns = this.columns.map(column => ({
      ...column,
      visible: column.visible !== false
    }));

    // Update displayed columns based on visibility
    this.updateDisplayedColumns();
  }

  private setupAccessibility(): void {
    // Add ARIA attributes for accessibility
    const table = document.querySelector('mat-table');
    if (table) {
      table.setAttribute('role', 'grid');
      table.setAttribute('aria-label', 'Data Grid');
    }
  }

  // Public Methods
  onSort(sortEvent: Sort): void {
    this.gridState.sort = sortEvent;
    
    if (this.serverSide) {
      this.sortChange.emit(sortEvent);
    } else {
      this.dataSource.data = this.sortData(this.dataSource.data, sortEvent);
      this.cdr.markForCheck();
    }
  }

  onPageChange(event: { pageIndex: number; pageSize: number }): void {
    this.gridState.pageIndex = event.pageIndex;
    this.gridState.pageSize = event.pageSize;

    if (this.serverSide) {
      this.pageChange.emit(event);
    } else {
      this.updateLocalPagination();
      this.cdr.markForCheck();
    }
  }

  onRowSelect(row: any): void {
    const rowId = row[this.uniqueKey];
    
    if (this.selectedItems.has(rowId)) {
      this.selectedItems.delete(rowId);
    } else {
      this.selectedItems.add(rowId);
    }

    this.gridState.selection = this.selectedItems;
    this.selectionChange.emit(Array.from(this.selectedItems));
    this.cdr.markForCheck();
  }

  refreshData(newData: any[]): void {
    try {
      this.dataSource.data = newData;
      this.totalItems = newData.length;
      
      if (!this.serverSide) {
        this.updateLocalPagination();
      }
      
      this.cdr.markForCheck();
    } catch (error) {
      this.handleError(error);
    }
  }

  // Private Helper Methods
  private sortData(data: any[], sort: Sort): any[] {
    if (!sort.active || sort.direction === '') {
      return data;
    }

    return data.sort((a, b) => {
      const isAsc = sort.direction === 'asc';
      const column = this.columns.find(c => c.key === sort.active);
      
      if (!column) return 0;

      const valueA = this.getCellValue(a, column);
      const valueB = this.getCellValue(b, column);

      return this.compare(valueA, valueB, isAsc);
    });
  }

  private updateLocalPagination(): void {
    const startIndex = this.gridState.pageIndex * this.gridState.pageSize;
    const endIndex = startIndex + this.gridState.pageSize;
    this.dataSource.data = this.data.slice(startIndex, endIndex);
  }

  private updateDisplayedColumns(): void {
    this.displayedColumns = this.columns
      .filter(column => column.visible)
      .map(column => column.key);

    if (this.selectable) {
      this.displayedColumns.unshift('select');
    }
  }

  private getCellValue(row: any, column: ColumnDefinition): any {
    const value = row[column.key];
    return column.formatter ? column.formatter(value) : value;
  }

  private compare(a: any, b: any, isAsc: boolean): number {
    if (a === b) return 0;
    if (a === null || a === undefined) return isAsc ? -1 : 1;
    if (b === null || b === undefined) return isAsc ? 1 : -1;
    
    return (a < b ? -1 : 1) * (isAsc ? 1 : -1);
  }

  private handleError(error: any): void {
    const errorHandler = handleApiError(error);
    errorHandler.subscribe({
      error: (err) => this.error.emit(err)
    });
  }
}