import { HttpClientModule } from '@angular/common/http';
import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { ServiceWorkerModule } from '@angular/service-worker';
import { CoreModule } from 'app/core';
import { HomeModule } from 'app/pages/home';
import { environment } from 'environments/environment';

import { AppComponent } from './app.component';
import { AppRoutingModule } from './app.routes';

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
    // TODO: figure out if additional per-feature configuration is needed for the service worker
    ServiceWorkerModule.register('/ngsw-worker.js', { enabled: environment.production }),
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}
