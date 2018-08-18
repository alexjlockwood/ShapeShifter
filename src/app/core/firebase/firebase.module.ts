import { NgModule } from '@angular/core';
import { AngularFireModule } from 'angularfire2';
import { AngularFireAuthModule } from 'angularfire2/auth';
import { AngularFirestoreModule } from 'angularfire2/firestore';
import { environment } from 'environments/environment';

@NgModule({
  imports: [
    AngularFireModule.initializeApp(environment.firebaseOptions),
    AngularFirestoreModule,
    AngularFireAuthModule,
  ],
})
export class FirebaseModule {}
