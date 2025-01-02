// @angular/core v16.x
import { 
  Component,
  Input,
  Output,
  EventEmitter,
  ChangeDetectionStrategy,
  OnInit,
  OnDestroy,
  ElementRef,
  Renderer2,
  HostListener
} from '@angular/core';

// rxjs v7.x
import { Subject, takeUntil, fromEvent, merge } from 'rxjs';

// @angular/animations v16.x
import { 
  animate,
  style,
  transition,
  trigger,
  state
} from '@angular/animations';

// @angular/cdk/a11y v16.x
import { FocusTrap, ConfigurableFocusTrapFactory } from '@angular/cdk/a11y';

// Internal imports
import { ButtonComponent } from '../button/button.component';
import { ThemeService } from '../../../core/services/theme.service';

// Constants
const ANIMATION_DURATION_MS = 200;
const BACKDROP_CLASS = 'modal-backdrop';
const MODAL_SIZES = {
  sm: '400px',
  md: '600px',
  lg: '800px'
};
const ESCAPE_KEY = 27;

@Component({
  selector: 'app-modal',
  template: `
    <div class="modal-container"
         [@modalAnimation]="animationState"
         [ngClass]="getModalClasses()"
         [style.maxWidth]="MODAL_SIZES[size]"
         role="dialog"
         [attr.aria-label]="ariaLabel"
         [attr.aria-describedby]="ariaDescribedBy"
         cdkTrapFocus>
      
      <div class="modal-header" *ngIf="title || showCloseButton">
        <h2 class="modal-title" *ngIf="title">{{title}}</h2>
        <app-button *ngIf="showCloseButton"
                   variant="icon"
                   ariaLabel="Close modal"
                   (clicked)="dismiss()">
          <mat-icon>close</mat-icon>
        </app-button>
      </div>

      <div class="modal-content">
        <ng-content></ng-content>
      </div>

      <div class="modal-footer" *ngIf="hasFooterContent">
        <ng-content select="[modal-footer]"></ng-content>
      </div>
    </div>
  `,
  styles: [`
    :host {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: var(--z-index-modal);
    }

    .modal-container {
      position: relative;
      width: 95%;
      max-height: 90vh;
      background: var(--color-surface);
      border-radius: var(--border-radius-md);
      box-shadow: var(--elevation-modal);
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }

    .modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--spacing-md);
      border-bottom: var(--border-width-thin) solid var(--color-border);
    }

    .modal-title {
      margin: 0;
      font-size: var(--font-size-h3);
      font-weight: var(--font-weight-medium);
      color: var(--color-text);
    }

    .modal-content {
      flex: 1;
      padding: var(--spacing-md);
      overflow-y: auto;
    }

    .modal-footer {
      padding: var(--spacing-md);
      border-top: var(--border-width-thin) solid var(--color-border);
      display: flex;
      justify-content: flex-end;
      gap: var(--spacing-sm);
    }

    .modal-centered {
      align-items: center;
    }

    .modal-backdrop {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: var(--color-overlay);
      z-index: var(--z-index-overlay);
    }
  `],
  animations: [
    trigger('modalAnimation', [
      state('void', style({
        transform: 'scale(0.7)',
        opacity: 0
      })),
      state('visible', style({
        transform: 'scale(1)',
        opacity: 1
      })),
      transition('void => visible', [
        animate(`${ANIMATION_DURATION_MS}ms ${ANIMATION_DURATION_MS}ms cubic-bezier(0.4, 0, 0.2, 1)`)
      ]),
      transition('visible => void', [
        animate(`${ANIMATION_DURATION_MS}ms cubic-bezier(0.4, 0, 0.2, 1)`)
      ])
    ])
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [ButtonComponent]
})
export class ModalComponent implements OnInit, OnDestroy {
  @Input() title?: string;
  @Input() size: keyof typeof MODAL_SIZES = 'md';
  @Input() showCloseButton = true;
  @Input() backdrop = true;
  @Input() centered = false;
  @Input() keyboard = true;
  @Input() closeOnBackdrop = true;
  @Input() ariaLabel?: string;
  @Input() ariaDescribedBy?: string;

  @Output() closed = new EventEmitter<void>();
  @Output() dismissed = new EventEmitter<void>();
  @Output() backdropClick = new EventEmitter<void>();

  private destroy$ = new Subject<void>();
  private focusTrap?: FocusTrap;
  animationState: 'void' | 'visible' = 'void';
  hasFooterContent = false;

  constructor(
    private elementRef: ElementRef,
    private renderer: Renderer2,
    private themeService: ThemeService,
    private focusTrapFactory: ConfigurableFocusTrapFactory
  ) {}

  ngOnInit(): void {
    this.setupBackdrop();
    this.setupKeyboardEvents();
    this.setupFocusTrap();
    this.setupThemeHandling();
    this.checkFooterContent();
    this.animationState = 'visible';
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.removeBackdrop();
    if (this.focusTrap) {
      this.focusTrap.destroy();
    }
  }

  @HostListener('window:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent): void {
    if (this.keyboard && event.keyCode === ESCAPE_KEY) {
      this.dismiss();
    }
  }

  close(): void {
    this.animationState = 'void';
    setTimeout(() => {
      this.closed.emit();
    }, ANIMATION_DURATION_MS);
  }

  dismiss(): void {
    this.animationState = 'void';
    setTimeout(() => {
      this.dismissed.emit();
    }, ANIMATION_DURATION_MS);
  }

  private setupBackdrop(): void {
    if (this.backdrop) {
      const backdropElement = this.renderer.createElement('div');
      this.renderer.addClass(backdropElement, BACKDROP_CLASS);
      this.renderer.appendChild(document.body, backdropElement);

      if (this.closeOnBackdrop) {
        fromEvent(backdropElement, 'click')
          .pipe(takeUntil(this.destroy$))
          .subscribe(() => {
            this.backdropClick.emit();
            this.dismiss();
          });
      }
    }
  }

  private removeBackdrop(): void {
    const backdrop = document.querySelector(`.${BACKDROP_CLASS}`);
    if (backdrop) {
      this.renderer.removeChild(document.body, backdrop);
    }
  }

  private setupFocusTrap(): void {
    this.focusTrap = this.focusTrapFactory.create(this.elementRef.nativeElement);
    this.focusTrap.focusInitialElementWhenReady();
  }

  private setupThemeHandling(): void {
    this.themeService.theme$
      .pipe(takeUntil(this.destroy$))
      .subscribe(theme => {
        this.renderer.setAttribute(this.elementRef.nativeElement, 'data-theme', theme);
      });
  }

  private setupKeyboardEvents(): void {
    if (this.keyboard) {
      merge(
        fromEvent<KeyboardEvent>(document, 'keydown'),
        fromEvent<KeyboardEvent>(document, 'keyup')
      ).pipe(
        takeUntil(this.destroy$)
      ).subscribe(event => {
        if (event.keyCode === ESCAPE_KEY) {
          event.preventDefault();
          this.dismiss();
        }
      });
    }
  }

  private checkFooterContent(): void {
    this.hasFooterContent = !!this.elementRef.nativeElement.querySelector('[modal-footer]');
  }

  private getModalClasses(): { [key: string]: boolean } {
    return {
      'modal-centered': this.centered,
      [`modal-${this.size}`]: true
    };
  }
}