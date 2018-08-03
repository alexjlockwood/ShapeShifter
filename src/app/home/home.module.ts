import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { CoreModule } from 'app/core';
import { MaterialModule } from 'app/shared';

import { HomeComponent } from './home.component';
import { HomeRoutingModule } from './home.routes';

@NgModule({
  imports: [CommonModule, CoreModule, HomeRoutingModule, MaterialModule],
  declarations: [HomeComponent],
})
export class HomeModule {}
