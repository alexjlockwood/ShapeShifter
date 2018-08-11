import { HttpClientModule } from '@angular/common/http';
import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { ServiceWorkerModule } from '@angular/service-worker';
import { CoreModule } from 'app/core';
import { environment } from 'environments/environment';

import { AppComponent } from './app.component';
import { AppRoutingModule } from './app.routes';
import { HomeModule } from './pages/home';
import { MaterialModule } from './shared';

@NgModule({
  declarations: [AppComponent],
  imports: [
    // Angular modules.
    BrowserModule,
    BrowserAnimationsModule,
    HttpClientModule,
    // App modules.
    AppRoutingModule,
    CoreModule,
    HomeModule,
    // TODO: figure out if this is needed once the { providedIn: root } stuff is cleaned up
    MaterialModule,
    // TODO: figure out if additional per-feature configuration is needed for the service worker
    ServiceWorkerModule.register('/ngsw-worker.js', { enabled: environment.production }),
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}
