import { NgModule } from '@angular/core';
import { SharedModule } from 'app/shared';

import { DashboardComponent } from './dashboard.component';
import { DashboardRoutingModule } from './dashboard.routes';

@NgModule({
  imports: [DashboardRoutingModule, SharedModule],
  declarations: [DashboardComponent],
})
export class DashboardModule {}
