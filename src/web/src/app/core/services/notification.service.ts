// @angular/core v16.x
import { 
  Injectable, 
  ApplicationRef, 
  ComponentFactoryResolver, 
  Injector, 
  EmbeddedViewRef,
  ComponentRef
} from '@angular/core';

// @angular/common/http v16.x
import { HttpClient } from '@angular/common/http';

// rxjs v7.x
import { 
  Subject, 
  Observable, 
  BehaviorSubject,
  timer
} from 'rxjs';
import { 
  takeUntil, 
  take, 
  catchError, 
  retry, 
  debounceTime 
} from 'rxjs/operators';

// Internal imports
import { ToastComponent, TOAST_TYPES } from '../../shared/components/toast/toast.component';
import { validateMessage } from '../../shared/utils/validation.utils';

// Notification types and configuration
export const NOTIFICATION_TYPES = {
  SUCCESS: 'success',
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info',
  PROGRESS: 'progress'
} as const;

export type NotificationType = keyof typeof NOTIFICATION_TYPES;

export interface NotificationConfig {
  duration?: number;
  priority?: number;
  icon?: string;
  action?: {
    label: string;
    callback: () => void;
  };
}

export interface NotificationMessage {
  id: string;
  message: string;
  type: NotificationType;
  config?: NotificationConfig;
}

// Constants
const DEFAULT_DURATION = 3000;
const MAX_TOASTS = 5;
const WEBSOCKET_RETRY_ATTEMPTS = 3;
const WEBSOCKET_RETRY_DELAY = 1000;

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private destroy$ = new Subject<void>();
  private activeToasts: ComponentRef<ToastComponent>[] = [];
  private notificationSubject = new Subject<NotificationMessage>();
  private notificationQueue = new BehaviorSubject<NotificationMessage[]>([]);
  private wsConnection: WebSocket | null = null;

  constructor(
    private appRef: ApplicationRef,
    private componentFactoryResolver: ComponentFactoryResolver,
    private injector: Injector,
    private http: HttpClient
  ) {
    this.initializeWebSocket();
    this.setupNotificationProcessing();
  }

  /**
   * Initialize WebSocket connection with retry logic
   */
  private initializeWebSocket(): void {
    const connect = () => {
      this.wsConnection = new WebSocket(`${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/api/notifications/ws`);
      
      this.wsConnection.onmessage = (event) => {
        try {
          const notification: NotificationMessage = JSON.parse(event.data);
          this.notificationSubject.next(notification);
        } catch (error) {
          console.error('Error parsing notification:', error);
        }
      };

      this.wsConnection.onclose = () => {
        timer(WEBSOCKET_RETRY_DELAY)
          .pipe(
            take(1),
            takeUntil(this.destroy$)
          )
          .subscribe(() => {
            this.initializeWebSocket();
          });
      };

      this.wsConnection.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.wsConnection?.close();
      };
    };

    connect();
  }

  /**
   * Set up notification queue processing
   */
  private setupNotificationProcessing(): void {
    this.notificationSubject
      .pipe(
        debounceTime(100),
        takeUntil(this.destroy$)
      )
      .subscribe((notification) => {
        const currentQueue = this.notificationQueue.value;
        
        if (this.activeToasts.length >= MAX_TOASTS) {
          this.notificationQueue.next([...currentQueue, notification]);
        } else {
          this.showNotification(notification.message, notification.type, notification.config);
        }
      });
  }

  /**
   * Display a notification toast
   */
  public showNotification(
    message: string,
    type: NotificationType,
    config?: NotificationConfig
  ): void {
    if (!validateMessage(message)) {
      console.error('Invalid notification message');
      return;
    }

    // Create and configure toast component
    const componentFactory = this.componentFactoryResolver.resolveComponentFactory(ToastComponent);
    const componentRef = componentFactory.create(this.injector);
    const componentInstance = componentRef.instance;

    // Configure toast properties
    componentInstance.message = message;
    componentInstance.type = type;
    componentInstance.duration = config?.duration ?? DEFAULT_DURATION;
    componentInstance.icon = config?.icon;

    // Add to active toasts
    this.activeToasts.push(componentRef);

    // Attach to application
    this.appRef.attachView(componentRef.hostView);
    const domElem = (componentRef.hostView as EmbeddedViewRef<any>).rootNodes[0];
    document.body.appendChild(domElem);

    // Handle toast closure
    componentInstance.closed
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        const index = this.activeToasts.indexOf(componentRef);
        if (index > -1) {
          this.activeToasts.splice(index, 1);
          this.appRef.detachView(componentRef.hostView);
          componentRef.destroy();

          // Process next queued notification if any
          const queue = this.notificationQueue.value;
          if (queue.length > 0) {
            const [next, ...remaining] = queue;
            this.notificationQueue.next(remaining);
            this.showNotification(next.message, next.type, next.config);
          }
        }
      });
  }

  /**
   * Show success notification
   */
  public success(message: string, config?: NotificationConfig): void {
    this.showNotification(message, NOTIFICATION_TYPES.SUCCESS, config);
  }

  /**
   * Show error notification
   */
  public error(message: string, config?: NotificationConfig): void {
    this.showNotification(message, NOTIFICATION_TYPES.ERROR, {
      ...config,
      duration: config?.duration ?? 5000 // Longer duration for errors
    });
  }

  /**
   * Show warning notification
   */
  public warning(message: string, config?: NotificationConfig): void {
    this.showNotification(message, NOTIFICATION_TYPES.WARNING, config);
  }

  /**
   * Show info notification
   */
  public info(message: string, config?: NotificationConfig): void {
    this.showNotification(message, NOTIFICATION_TYPES.INFO, config);
  }

  /**
   * Show progress notification
   */
  public progress(message: string, config?: NotificationConfig): void {
    this.showNotification(message, NOTIFICATION_TYPES.PROGRESS, {
      ...config,
      duration: 0 // Progress notifications don't auto-dismiss
    });
  }

  /**
   * Clear all active notifications
   */
  public clear(): void {
    this.activeToasts.forEach(toast => {
      toast.instance.close();
    });
    this.notificationQueue.next([]);
  }

  /**
   * Cleanup on service destruction
   */
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.wsConnection?.close();
    this.clear();
  }
}