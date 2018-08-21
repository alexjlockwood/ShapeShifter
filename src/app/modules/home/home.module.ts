import { NgModule } from '@angular/core';
import { SharedModule } from 'app/shared';

import { HomeComponent } from './home.component';
import { HomeRoutingModule } from './home.routes';
import { DashboardComponent } from './pages/dashboard';
import { LandingComponent } from './pages/landing';

@NgModule({
  imports: [HomeRoutingModule, SharedModule],
  declarations: [HomeComponent, DashboardComponent, LandingComponent],
})
export class HomeModule {}
