// Angular Core v16.x
import { NgModule, ModuleWithProviders } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { DomSanitizer } from '@angular/platform-browser';

// Angular Material v16.x
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialogModule } from '@angular/material/dialog';
import { MatSortModule } from '@angular/material/sort';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatRippleModule } from '@angular/material/core';

// Internal Components
import { ButtonComponent } from './components/button/button.component';
import { CardComponent } from './components/card/card.component';
import { DataGridComponent } from './components/data-grid/data-grid.component';
import { PaginationComponent } from './components/pagination/pagination.component';

// Configuration Interface
interface SharedModuleConfig {
  production: boolean;
  securityConfig?: {
    sanitizeHtml: boolean;
    validateInputs: boolean;
    preventXSS: boolean;
  };
}

/**
 * SharedModule centralizes common components, directives, and utilities
 * implementing the Nexus Platform design system with enhanced security.
 */
@NgModule({
  declarations: [
    ButtonComponent,
    CardComponent,
    DataGridComponent,
    PaginationComponent
  ],
  imports: [
    // Angular Core
    CommonModule,
    ReactiveFormsModule,
    FormsModule,

    // Material Design
    MatButtonModule,
    MatCardModule,
    MatInputModule,
    MatSelectModule,
    MatTableModule,
    MatSnackBarModule,
    MatDialogModule,
    MatSortModule,
    MatCheckboxModule,
    MatPaginatorModule,
    MatRippleModule
  ],
  exports: [
    // Angular Core
    CommonModule,
    ReactiveFormsModule,
    FormsModule,

    // Material Design
    MatButtonModule,
    MatCardModule,
    MatInputModule,
    MatSelectModule,
    MatTableModule,
    MatSnackBarModule,
    MatDialogModule,
    MatSortModule,
    MatCheckboxModule,
    MatPaginatorModule,
    MatRippleModule,

    // Components
    ButtonComponent,
    CardComponent,
    DataGridComponent,
    PaginationComponent
  ]
})
export class SharedModule {
  static version = '1.0.0';
  private static config: SharedModuleConfig;

  /**
   * Configures SharedModule with security and environment settings
   * @param config Module configuration options
   * @returns ModuleWithProviders<SharedModule>
   */
  static forRoot(config: SharedModuleConfig): ModuleWithProviders<SharedModule> {
    SharedModule.config = {
      production: config.production,
      securityConfig: {
        sanitizeHtml: true,
        validateInputs: true,
        preventXSS: true,
        ...config.securityConfig
      }
    };

    return {
      ngModule: SharedModule,
      providers: [
        {
          provide: 'SHARED_MODULE_CONFIG',
          useValue: SharedModule.config
        },
        {
          provide: DomSanitizer,
          useClass: DomSanitizer
        }
      ]
    };
  }

  /**
   * Configures SharedModule for feature modules without global providers
   * @returns ModuleWithProviders<SharedModule>
   */
  static forChild(): ModuleWithProviders<SharedModule> {
    return {
      ngModule: SharedModule
    };
  }

  /**
   * Returns current module configuration
   * @returns SharedModuleConfig
   */
  static getConfig(): SharedModuleConfig {
    return SharedModule.config;
  }

  /**
   * Checks if module is running in production mode
   * @returns boolean
   */
  static isProduction(): boolean {
    return SharedModule.config?.production || false;
  }

  /**
   * Validates if security features are enabled
   * @returns boolean
   */
  static isSecurityEnabled(): boolean {
    return SharedModule.config?.securityConfig?.validateInputs || false;
  }
}