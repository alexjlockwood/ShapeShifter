import { HttpClientModule } from '@angular/common/http';
import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { CoreModule } from 'app/core';
import { SharedModule } from 'app/shared';

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
    // TODO: remove this (clean up the editor services and remove providedIn: root)
    SharedModule,
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}
