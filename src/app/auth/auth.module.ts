import { NgModule } from '@angular/core';

import { AuthComponent } from './auth.component';
import { AuthRoutingModule } from './auth.routes';
import { NoAuthGuard } from './noauth.guard';

@NgModule({
  imports: [AuthRoutingModule],
  declarations: [AuthComponent],
  providers: [NoAuthGuard],
})
export class AuthModule {}
