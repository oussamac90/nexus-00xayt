// Angular Core v16.x
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

// Feature Components
import { ShippingComponent } from './shipping.component';
import { ShipmentTrackingComponent } from './components/shipment-tracking/shipment-tracking.component';
import { ShippingRatesComponent } from './components/shipping-rates/shipping-rates.component';

// Route Configuration
const routes: Routes = [
  {
    path: '',
    component: ShippingComponent,
    data: {
      title: 'Shipping Management',
      breadcrumb: 'Shipping',
      roles: ['shipping_user', 'admin'],
      reuse: false
    },
    children: [
      {
        path: '',
        redirectTo: 'rates',
        pathMatch: 'full'
      },
      {
        path: 'rates',
        component: ShippingRatesComponent,
        data: {
          title: 'Shipping Rates',
          breadcrumb: 'Rates',
          reuse: true,
          preload: true
        }
      },
      {
        path: 'tracking/:orderId',
        component: ShipmentTrackingComponent,
        data: {
          title: 'Shipment Tracking',
          breadcrumb: 'Tracking',
          reuse: false
        }
      },
      {
        path: 'documents',
        loadChildren: () => import('./documents/documents.module').then(m => m.DocumentsModule),
        data: {
          title: 'Shipping Documents',
          breadcrumb: 'Documents',
          roles: ['shipping_user', 'admin']
        }
      }
    ]
  }
];

@NgModule({
  imports: [
    RouterModule.forChild(routes)
  ],
  exports: [
    RouterModule
  ]
})
export class ShippingRoutingModule {}