import { NgModule } from '@angular/core';
import { SharedModule } from 'app/shared';
import { LottieAnimationViewModule } from 'ng-lottie';

import { HomeComponent } from './home.component';
import { HomeRoutingModule } from './home.routes';

@NgModule({
  imports: [HomeRoutingModule, SharedModule, LottieAnimationViewModule.forRoot()],
  declarations: [HomeComponent],
})
export class HomeModule {}
