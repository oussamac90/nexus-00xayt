// @angular/material/core v16.x
import { 
  Component, 
  Input, 
  Output, 
  EventEmitter, 
  ContentChildren, 
  QueryList, 
  AfterContentInit, 
  ChangeDetectionStrategy,
  OnDestroy,
  ElementRef,
  ViewChild,
  ViewEncapsulation,
  ChangeDetectorRef
} from '@angular/core';

// @angular/material/tabs v16.x
import { MatTabsModule, MatTab } from '@angular/material/tabs';

// @angular/material/core v16.x
import { MatRippleModule } from '@angular/material/core';

// Internal imports
import { isValidTabIndex } from '../../utils/validation.utils';

// RxJS imports for subscription management
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-tabs',
  template: `
    <div class="nexus-tabs-container" #tabContainer
         [attr.aria-label]="ariaLabel">
      <mat-tab-group
        [selectedIndex]="selectedIndex"
        [dynamicHeight]="dynamicHeight"
        [backgroundColor]="backgroundColor"
        [disableRipple]="disableRipple"
        (selectedIndexChange)="handleTabChange($event)"
        (animationDone)="handleAnimationDone()">
        <ng-content></ng-content>
      </mat-tab-group>
    </div>
  `,
  styles: [`
    .nexus-tabs-container {
      width: 100%;
      overflow: hidden;
    }

    :host ::ng-deep .mat-tab-header {
      border-bottom: 1px solid rgba(0, 0, 0, 0.12);
    }

    :host ::ng-deep .mat-tab-label {
      min-width: 120px;
      padding: 0 24px;
      height: 48px;
      font-family: Roboto, sans-serif;
      font-size: 14px;
      font-weight: 500;
      opacity: 0.7;
    }

    :host ::ng-deep .mat-tab-label-active {
      opacity: 1;
    }

    @media (max-width: 768px) {
      :host ::ng-deep .mat-tab-label {
        min-width: 90px;
        padding: 0 16px;
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None
})
export class TabsComponent implements AfterContentInit, OnDestroy {
  // Input properties with default values
  @Input() selectedIndex = 0;
  @Input() dynamicHeight = true;
  @Input() backgroundColor: 'primary' | 'accent' | 'warn' = 'primary';
  @Input() disableRipple = false;
  @Input() ariaLabel = 'Tab navigation';

  // Content children and view child references
  @ContentChildren(MatTab) tabs!: QueryList<MatTab>;
  @ViewChild('tabContainer') tabContainer!: ElementRef;

  // Output event emitters
  @Output() selectedIndexChange = new EventEmitter<number>();
  @Output() animationDone = new EventEmitter<void>();
  @Output() error = new EventEmitter<Error>();

  // Private properties for internal state management
  private destroy$ = new Subject<void>();
  private initialized = false;

  constructor(
    private changeDetector: ChangeDetectorRef,
    private elementRef: ElementRef
  ) {}

  ngAfterContentInit(): void {
    try {
      // Validate initial configuration
      this.validateConfiguration();

      // Subscribe to tab changes
      this.tabs.changes
        .pipe(takeUntil(this.destroy$))
        .subscribe(() => {
          this.validateConfiguration();
          this.changeDetector.markForCheck();
        });

      // Set initial tab if valid
      if (isValidTabIndex(this.selectedIndex, this.tabs.length)) {
        this.selectTab(this.selectedIndex);
      } else {
        this.selectTab(0);
      }

      this.initialized = true;
      this.changeDetector.markForCheck();

    } catch (error) {
      this.handleError(error as Error);
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Handles tab selection change events
   * @param index The index of the newly selected tab
   */
  private handleTabChange(index: number): void {
    try {
      if (this.initialized && isValidTabIndex(index, this.tabs.length)) {
        this.selectedIndex = index;
        this.selectedIndexChange.emit(index);
        this.changeDetector.markForCheck();
      }
    } catch (error) {
      this.handleError(error as Error);
    }
  }

  /**
   * Handles tab animation completion events
   */
  private handleAnimationDone(): void {
    try {
      this.animationDone.emit();
      this.changeDetector.markForCheck();
    } catch (error) {
      this.handleError(error as Error);
    }
  }

  /**
   * Validates the component's configuration
   */
  private validateConfiguration(): void {
    if (!this.tabs) {
      throw new Error('No tabs found in the component');
    }

    if (this.tabs.length === 0) {
      throw new Error('At least one tab is required');
    }

    if (!isValidTabIndex(this.selectedIndex, this.tabs.length)) {
      throw new Error(`Invalid selected index: ${this.selectedIndex}`);
    }
  }

  /**
   * Selects a tab by index
   * @param index The index of the tab to select
   */
  private selectTab(index: number): void {
    if (isValidTabIndex(index, this.tabs.length)) {
      this.selectedIndex = index;
      this.selectedIndexChange.emit(index);
      this.changeDetector.markForCheck();
    }
  }

  /**
   * Handles and emits component errors
   * @param error The error to handle
   */
  private handleError(error: Error): void {
    console.error('TabsComponent Error:', error);
    this.error.emit(error);
    this.changeDetector.markForCheck();
  }
}