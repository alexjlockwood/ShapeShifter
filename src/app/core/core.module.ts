import { CommonModule } from '@angular/common';
import { ErrorHandler, NgModule, Optional, SkipSelf } from '@angular/core';
import { StoreModule } from '@ngrx/store';
import { StoreDevtoolsModule } from '@ngrx/store-devtools';
import { AngularFireModule } from 'angularfire2';
import { AngularFireAuthModule } from 'angularfire2/auth';
import { AngularFirestoreModule } from 'angularfire2/firestore';
import { errorHandlerFactory } from 'app/modules/editor/scripts/bugsnag';
import { environment } from 'environments/environment';

import { AuthGuard } from './guards';
import { AuthService } from './services';
import { metaReducers, reducers } from './store/reducer';

/**
 * The core module contains singleton services that are loaded when the application
 * first starts. It should only be imported by the root AppModule.
 */
@NgModule({
  imports: [
    CommonModule,
    AngularFireModule.initializeApp(environment.firebaseOptions),
    AngularFirestoreModule,
    AngularFireAuthModule,
    StoreModule.forRoot(reducers, { metaReducers }),
    ...(environment.production ? [] : [StoreDevtoolsModule.instrument()]),
  ],
  providers: [AuthGuard, AuthService, { provide: ErrorHandler, useFactory: errorHandlerFactory }],
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
