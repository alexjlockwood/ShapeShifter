import { HttpClientModule } from '@angular/common/http';
import { ErrorHandler, NgModule } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { ServiceWorkerModule } from '@angular/service-worker';
import { StoreModule } from '@ngrx/store';
import { CoreModule } from 'app/core';
import { errorHandlerFactory } from 'app/editor/scripts/bugsnag';
import { metaReducers, reducers } from 'app/editor/store';
import { environment } from 'environments/environment';

import { AppComponent } from './app.component';
import { AppRoutingModule } from './app.routes';
import { HomeModule } from './home';
import { MaterialModule } from './shared';

@NgModule({
  declarations: [AppComponent],
  imports: [
    // Angular modules.
    BrowserModule,
    BrowserAnimationsModule,
    HttpClientModule,
    ReactiveFormsModule,
    // App modules.
    AppRoutingModule,
    CoreModule,
    HomeModule,
    // TODO: figure out if this is needed once the { providedIn: root } stuff is cleaned up
    MaterialModule,
    // TODO: figure out if additional per-feature configuration is needed for the service worker
    ServiceWorkerModule.register('/ngsw-worker.js', { enabled: environment.production }),
    // TODO: figure out how to split this state up into individual features?
    StoreModule.forRoot(reducers, { metaReducers }),
  ],
  providers: [{ provide: ErrorHandler, useFactory: errorHandlerFactory }],
  bootstrap: [AppComponent],
})
export class AppModule {}
