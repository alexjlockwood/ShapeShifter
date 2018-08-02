import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
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
export class CoreModule {}
