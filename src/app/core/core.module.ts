import { CommonModule } from '@angular/common';
import { ErrorHandler, NgModule, Optional, SkipSelf } from '@angular/core';
import { ServiceWorkerModule } from '@angular/service-worker';
import { EffectsModule } from '@ngrx/effects';
import { StoreRouterConnectingModule } from '@ngrx/router-store';
import { StoreModule } from '@ngrx/store';
import { StoreDevtoolsModule } from '@ngrx/store-devtools';
import { AngularFireModule } from 'angularfire2';
import { AngularFireAuthModule } from 'angularfire2/auth';
import { AngularFirestoreModule } from 'angularfire2/firestore';
import { errorHandlerFactory } from 'app/pages/editor/scripts/bugsnag';
import { environment } from 'environments/environment';

import { AuthGuard, AuthService } from './auth/services';
import { AuthEffects } from './auth/store/auth.effects';
import { ProjectsService } from './projects/services/projects.service';
import { ProjectsEffects } from './projects/store/projects.effects';
import { RouterEffects } from './router/store/router.effects';
import { metaReducers, reducers } from './store/core.reducer';

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
    EffectsModule.forRoot([AuthEffects, ProjectsEffects, RouterEffects]),
    StoreRouterConnectingModule.forRoot(),
    ...(environment.production ? [] : [StoreDevtoolsModule.instrument()]),
    // TODO: figure out if additional per-feature configuration is needed for the service worker
    ServiceWorkerModule.register('/ngsw-worker.js', { enabled: environment.production }),
  ],
  providers: [
    AuthGuard,
    AuthService,
    ProjectsService,
    { provide: ErrorHandler, useFactory: errorHandlerFactory },
  ],
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
