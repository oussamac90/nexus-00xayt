// @angular/core v16.x
import { NgModule } from '@angular/core';
// @angular/router v16.x
import { RouterModule, Routes } from '@angular/router';

// Internal Components
import { MarketplaceComponent } from './marketplace.component';
import { ProductCatalogComponent } from './components/product-catalog/product-catalog.component';
import { ProductDetailComponent } from './components/product-detail/product-detail.component';

// Guards
import { AuthGuard } from '../../core/auth/auth.guard';

/**
 * Marketplace feature routing configuration with secure, lazy-loaded routes
 * and integrated analytics tracking.
 */
const routes: Routes = [
  {
    path: '',
    component: MarketplaceComponent,
    canActivate: [AuthGuard],
    data: {
      title: 'B2B Marketplace',
      roles: ['USER', 'VENDOR', 'ADMIN'],
      analytics: {
        section: 'marketplace',
        pageType: 'feature'
      }
    },
    children: [
      {
        path: '',
        component: ProductCatalogComponent,
        data: {
          title: 'Product Catalog',
          analytics: {
            section: 'marketplace',
            pageType: 'catalog',
            standardsEnabled: true
          }
        }
      },
      {
        path: 'products/:id',
        component: ProductDetailComponent,
        data: {
          title: 'Product Details',
          roles: ['USER', 'VENDOR', 'ADMIN'],
          requireMfa: true, // Require MFA for sensitive product data
          analytics: {
            section: 'marketplace',
            pageType: 'product-detail',
            standardsEnabled: true
          }
        }
      },
      {
        path: '**',
        redirectTo: '',
        pathMatch: 'full'
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
export class MarketplaceRoutingModule {}