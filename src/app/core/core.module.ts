import { CommonModule } from '@angular/common';
import { NgModule, Optional, SkipSelf } from '@angular/core';
import { AngularFireModule } from 'angularfire2';
import { AngularFireAuthModule } from 'angularfire2/auth';
import { AngularFirestoreModule } from 'angularfire2/firestore';
import { environment } from 'environments/environment';

import { AuthGuard } from './guards';
import { AuthService } from './services';

@NgModule({
  imports: [
    CommonModule,
    AngularFireModule.initializeApp(environment.firebaseOptions),
    AngularFirestoreModule,
    AngularFireAuthModule,
  ],
  providers: [AuthGuard, AuthService],
})
export class CoreModule {
  constructor(
    @Optional()
    @SkipSelf()
    parentModule: CoreModule,
  ) {
    if (parentModule) {
      throw new Error('CoreModule should only be imported by AppModule.');
    }
  }
}
