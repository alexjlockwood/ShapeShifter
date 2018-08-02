import { HttpClientModule } from '@angular/common/http';
import { NgModule } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { ServiceWorkerModule } from '@angular/service-worker';
import { StoreModule } from '@ngrx/store';
import { metaReducers, reducers } from 'app/editor/store';
import { CoreModule } from 'app/firebase/core/core.module';
import { ProjectListComponent } from 'app/firebase/projectlist/projectlist.component';
import { environment } from 'environments/environment';

import { AppComponent } from './app.component';
import { AppRoutingModule } from './app.routes';
import { LandingComponent } from './firebase/landing/landing.component';
import { LoginComponent } from './firebase/login/login.component';
import { ProjectResolver } from './firebase/project/project.resolver';
import { MaterialModule } from './material.module';

@NgModule({
  declarations: [AppComponent, LoginComponent, LandingComponent, ProjectListComponent],
  imports: [
    // Angular modules.
    BrowserModule,
    BrowserAnimationsModule,
    HttpClientModule,
    ReactiveFormsModule,
    // App modules.
    AppRoutingModule,
    CoreModule,
    // TODO: figure out if this is needed once the { providedIn: root } stuff is cleaned up
    MaterialModule,
    // TODO: figure out if additional per-feature configuration is needed for the service worker
    ServiceWorkerModule.register('/ngsw-worker.js', { enabled: environment.production }),
    // TODO: figure out how to split this state up into individual features?
    StoreModule.forRoot(reducers, { metaReducers }),
  ],
  providers: [ProjectResolver],
  bootstrap: [AppComponent],
})
export class AppModule {}
