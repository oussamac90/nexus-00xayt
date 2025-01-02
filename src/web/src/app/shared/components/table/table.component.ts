import { 
  Component, 
  Input, 
  Output, 
  EventEmitter, 
  OnInit, 
  OnDestroy, 
  ViewChild, 
  ChangeDetectionStrategy, 
  ChangeDetectorRef 
} from '@angular/core';
import { 
  MatTableModule, 
  MatTableDataSource, 
  MatSort, 
  MatSortModule, 
  MatTable 
} from '@angular/material/table';
import { 
  MatFormFieldModule, 
  MatInputModule 
} from '@angular/material/form-field';
import { 
  Subject, 
  Subscription, 
  debounceTime, 
  distinctUntilChanged, 
  takeUntil 
} from 'rxjs';

import { PaginationComponent } from '../pagination/pagination.component';
import { LoaderComponent } from '../loader/loader.component';

@Component({
  selector: 'app-table',
  templateUrl: './table.component.html',
  styleUrls: ['./table.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    MatTableModule,
    MatSortModule,
    MatFormFieldModule,
    MatInputModule,
    PaginationComponent,
    LoaderComponent
  ],
  host: {
    'role': 'grid',
    'class': 'app-table'
  }
})
export class TableComponent implements OnInit, OnDestroy {
  @Input() data: any[] = [];
  @Input() displayedColumns: string[] = [];
  @Input() isLoading = false;
  @Input() pageSize = 10;
  @Input() sortable = true;
  @Input() filterable = true;

  @Output() rowClick = new EventEmitter<any>();
  @Output() sortChange = new EventEmitter<any>();
  @Output() filterChange = new EventEmitter<string>();

  dataSource: MatTableDataSource<any>;
  @ViewChild(MatSort) sort!: MatSort;
  @ViewChild(MatTable) table!: MatTable<any>;

  private destroy$ = new Subject<void>();
  private filterSubject = new Subject<string>();
  private sortSubscription?: Subscription;

  constructor(private cdr: ChangeDetectorRef) {
    this.dataSource = new MatTableDataSource<any>([]);
    
    // Set up debounced filter
    this.filterSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(filterValue => {
      this.filterChange.emit(filterValue);
    });
  }

  ngOnInit(): void {
    // Initialize data source
    this.dataSource.data = this.data;

    // Configure sorting
    if (this.sortable) {
      this.dataSource.sort = this.sort;
      this.dataSource.sortingDataAccessor = (item: any, property: string) => {
        return typeof item[property] === 'string' 
          ? item[property].toLowerCase() 
          : item[property];
      };
    }

    // Configure filtering
    if (this.filterable) {
      this.dataSource.filterPredicate = (data: any, filter: string) => {
        const searchStr = JSON.stringify(data).toLowerCase();
        return searchStr.indexOf(filter.toLowerCase()) !== -1;
      };
    }

    // Subscribe to sort changes
    this.sortSubscription = this.sort?.sortChange
      .pipe(takeUntil(this.destroy$))
      .subscribe(event => {
        this.sortChange.emit(event);
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.sortSubscription?.unsubscribe();
  }

  applyFilter(event: Event): void {
    const filterValue = (event.target as HTMLInputElement).value;
    this.dataSource.filter = filterValue.trim().toLowerCase();
    this.filterSubject.next(filterValue);

    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }

  onRowClick(row: any): void {
    this.rowClick.emit(row);
  }

  updateData(data: any[]): void {
    this.dataSource.data = data;
    this.cdr.markForCheck();

    if (this.table) {
      this.table.renderRows();
    }
  }

  clearFilter(): void {
    this.dataSource.filter = '';
    this.filterSubject.next('');
    this.cdr.markForCheck();
  }

  getAriaLabel(column: string): string {
    return `Sort by ${column}`;
  }

  getAriaSort(column: string): string {
    if (!this.sort) return 'none';
    return this.sort.active === column ? this.sort.direction : 'none';
  }

  trackByFn(index: number, item: any): any {
    return item.id || index;
  }
}