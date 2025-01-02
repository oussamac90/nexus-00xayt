// @angular/core v16.x - Core Angular decorators and lifecycle hooks
import { 
  Component, 
  Input, 
  Output, 
  EventEmitter, 
  ChangeDetectionStrategy, 
  OnInit, 
  OnDestroy 
} from '@angular/core';

// @angular/material/dialog v16.x - Material Design dialog implementation
import { 
  MatDialog, 
  MatDialogRef, 
  MatDialogConfig 
} from '@angular/material/dialog';

// rxjs v7.x - RxJS utilities for subscription management
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

// Internal components
import { ButtonComponent } from '../button/button.component';

/**
 * Enhanced Material Design dialog component implementing Nexus Platform design system.
 * Provides configurable modal dialogs with consistent styling and accessibility support.
 *
 * @example
 * <app-dialog
 *   title="Confirm Action"
 *   message="Are you sure you want to proceed?"
 *   [actions]="['cancel', 'confirm']"
 *   [showCloseButton]="true"
 *   [disableClose]="false"
 *   (closed)="handleClose($event)"
 *   (actionSelected)="handleAction($event)">
 * </app-dialog>
 */
@Component({
  selector: 'app-dialog',
  template: `
    <div class="dialog-container" role="dialog" 
         [attr.aria-label]="ariaLabel"
         [attr.aria-describedby]="ariaDescribedBy">
      
      <!-- Dialog Header -->
      <div class="dialog-header" *ngIf="title">
        <h2 class="dialog-title" id="dialog-title">{{title}}</h2>
        <button *ngIf="showCloseButton" 
                mat-icon-button 
                class="dialog-close"
                aria-label="Close dialog"
                (click)="close()">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <!-- Dialog Content -->
      <div class="dialog-content" [id]="ariaDescribedBy">
        <p *ngIf="message" class="dialog-message">{{message}}</p>
        <ng-content></ng-content>
      </div>

      <!-- Dialog Actions -->
      <div class="dialog-actions" *ngIf="actions?.length">
        <app-button *ngFor="let action of actions"
                   [variant]="getActionButtonVariant(action)"
                   [color]="getActionButtonColor(action)"
                   [ariaLabel]="action"
                   (clicked)="onActionClick(action)">
          {{action | titlecase}}
        </app-button>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }

    .dialog-container {
      padding: 24px;
      min-width: 280px;
      max-width: 80vw;
      max-height: 80vh;
      overflow: auto;
    }

    .dialog-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }

    .dialog-title {
      margin: 0;
      font-family: Roboto, sans-serif;
      font-size: 24px;
      font-weight: 500;
      color: rgba(0, 0, 0, 0.87);
    }

    .dialog-content {
      margin-bottom: 24px;
      font-size: 16px;
      line-height: 1.5;
      color: rgba(0, 0, 0, 0.6);
    }

    .dialog-message {
      margin: 0 0 16px;
    }

    .dialog-actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }

    .dialog-close {
      margin: -12px -12px -12px 0;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DialogComponent implements OnInit, OnDestroy {
  @Input() title?: string;
  @Input() message?: string;
  @Input() showCloseButton = true;
  @Input() actions: string[] = [];
  @Input() data: any;
  @Input() width?: string;
  @Input() disableClose = false;
  @Input() ariaLabel?: string;
  @Input() ariaDescribedBy = 'dialog-content';

  @Output() closed = new EventEmitter<any>();
  @Output() actionSelected = new EventEmitter<string>();

  private destroy$ = new Subject<void>();
  private dialogConfig: MatDialogConfig;

  constructor(
    private dialog: MatDialog,
    private dialogRef: MatDialogRef<DialogComponent>
  ) {
    this.dialogConfig = new MatDialogConfig();
    this.initializeDialogConfig();
  }

  ngOnInit(): void {
    this.setupDialogConfiguration();
    this.setupKeyboardHandling();
    this.setupDialogSubscriptions();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Handles dialog closure with proper cleanup
   * @param result Optional result data to emit
   */
  close(result?: any): void {
    this.closed.emit(result);
    this.dialogRef.close(result);
  }

  /**
   * Handles dialog action button clicks
   * @param action Action identifier string
   */
  onActionClick(action: string): void {
    this.actionSelected.emit(action);
    
    // Auto-close dialog for certain actions
    if (action.toLowerCase() === 'close' || 
        action.toLowerCase() === 'cancel' || 
        action.toLowerCase() === 'confirm') {
      this.close(action);
    }
  }

  /**
   * Determines button variant based on action type
   * @param action Action identifier string
   * @returns Material button variant
   */
  private getActionButtonVariant(action: string): 'text' | 'outlined' | 'contained' {
    switch (action.toLowerCase()) {
      case 'confirm':
      case 'submit':
      case 'save':
        return 'contained';
      case 'cancel':
      case 'close':
        return 'outlined';
      default:
        return 'text';
    }
  }

  /**
   * Determines button color based on action type
   * @param action Action identifier string
   * @returns Material button color
   */
  private getActionButtonColor(action: string): 'primary' | 'warn' | 'accent' {
    switch (action.toLowerCase()) {
      case 'delete':
      case 'remove':
        return 'warn';
      case 'confirm':
      case 'submit':
      case 'save':
        return 'primary';
      default:
        return 'accent';
    }
  }

  /**
   * Initializes dialog configuration with Material Design specs
   */
  private initializeDialogConfig(): void {
    this.dialogConfig = {
      width: this.width || '400px',
      disableClose: this.disableClose,
      autoFocus: true,
      role: 'dialog',
      ariaLabel: this.ariaLabel,
      ariaDescribedBy: this.ariaDescribedBy,
      panelClass: 'nexus-dialog',
      data: this.data
    };
  }

  /**
   * Sets up dialog configuration and accessibility
   */
  private setupDialogConfiguration(): void {
    this.dialogRef.updateSize(this.dialogConfig.width);
    this.dialogRef.disableClose = this.dialogConfig.disableClose;
  }

  /**
   * Sets up keyboard event handling for dialog
   */
  private setupKeyboardHandling(): void {
    if (!this.disableClose) {
      this.dialogRef.keydownEvents()
        .pipe(takeUntil(this.destroy$))
        .subscribe(event => {
          if (event.key === 'Escape') {
            this.close();
          }
        });
    }
  }

  /**
   * Sets up dialog-related subscriptions
   */
  private setupDialogSubscriptions(): void {
    this.dialogRef.beforeClosed()
      .pipe(takeUntil(this.destroy$))
      .subscribe(result => {
        this.closed.emit(result);
      });
  }
}