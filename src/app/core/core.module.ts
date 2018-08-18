import { CommonModule } from '@angular/common';
import { ErrorHandler, NgModule, Optional, SkipSelf } from '@angular/core';
import { MatIconRegistry } from '@angular/material';
import { DomSanitizer } from '@angular/platform-browser';
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

import { AuthGuard, AuthService } from './services/auth';
import { ProjectsService } from './services/projects/projects.service';
import { AuthEffects } from './store/auth/auth.effects';
import { metaReducers, reducers } from './store/core.reducer';
import { ProjectsEffects } from './store/projects/projects.effects';
import { RouterEffects } from './store/router/router.effects';

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
    matIconRegistry: MatIconRegistry,
    sanitizer: DomSanitizer,
  ) {
    if (parentModule) {
      throw new Error('CoreModule should only be imported by AppModule.');
    }
    // TODO: should we put icon registry stuff in a separate module?
    matIconRegistry.addSvgIcon(
      'shapeshifter',
      sanitizer.bypassSecurityTrustResourceUrl('assets/shapeshifter.svg'),
    );
  }
}
