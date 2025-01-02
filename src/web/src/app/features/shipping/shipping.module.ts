// Angular Core v16.x
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';

// Angular Material v16.x
import { MatTabsModule } from '@angular/material/tabs';
import { MatCardModule } from '@angular/material/card';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBarModule } from '@angular/material/snack-bar';

// Feature Components
import { ShippingComponent } from './shipping.component';
import { ShippingRatesComponent } from './components/shipping-rates/shipping-rates.component';
import { ShipmentTrackingComponent } from './components/shipment-tracking/shipment-tracking.component';

// Routing
import { ShippingRoutingModule } from './shipping-routing.module';

// Shared Module
import { SharedModule } from '../../shared/shared.module';

/**
 * Feature module for shipping functionality in the Nexus Platform
 * Implements multi-carrier integration, real-time tracking, and shipping documentation management
 * with Material Design components and accessibility compliance
 */
@NgModule({
  declarations: [
    ShippingComponent,
    ShippingRatesComponent,
    ShipmentTrackingComponent
  ],
  imports: [
    // Angular Core Modules
    CommonModule,
    ReactiveFormsModule,
    
    // Feature Routing
    ShippingRoutingModule,
    
    // Material Design Modules
    MatTabsModule,
    MatCardModule,
    MatProgressBarModule,
    MatSnackBarModule,
    
    // Shared Module with common components
    SharedModule
  ],
  exports: [
    // Export main component for use in parent modules
    ShippingComponent
  ]
})
export class ShippingModule {}