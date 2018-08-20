import { CommonModule } from '@angular/common';
import { ErrorHandler, NgModule, Optional, SkipSelf } from '@angular/core';
import { ServiceWorkerModule } from '@angular/service-worker';
import { errorHandlerFactory } from 'app/pages/editor/scripts/bugsnag';
import { environment } from 'environments/environment';

import { FirebaseModule } from './firebase';
import { IconRegistryModule } from './icon-registry';
import { AppStoreModule } from './store';

/**
 * The core module contains singleton services that are loaded when the application
 * first starts. It should only be imported by the root AppModule.
 */
@NgModule({
  imports: [
    AppStoreModule,
    CommonModule,
    FirebaseModule,
    IconRegistryModule,
    ServiceWorkerModule.register('/ngsw-worker.js', { enabled: environment.production }),
  ],
  providers: [{ provide: ErrorHandler, useFactory: errorHandlerFactory }],
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
