import { NgModule } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { BrowserModule } from '@angular/platform-browser';
import { AppModule as ProjectEditorModule } from 'app/app.module';
import { AppRoutingModule } from 'app/firebase/app-routing.module';
import { CoreModule } from 'app/firebase/core/core.module';
import { ProjectListComponent } from 'app/firebase/projectlist/projectlist.component';

import { AppComponent } from './app.component';
import { LandingComponent } from './landing/landing.component';
import { LoginComponent } from './login/login.component';
import { ProjectResolver } from './project/project.resolver';

@NgModule({
  declarations: [AppComponent, LoginComponent, LandingComponent, ProjectListComponent],
  imports: [BrowserModule, ReactiveFormsModule, AppRoutingModule, CoreModule, ProjectEditorModule],
  providers: [ProjectResolver],
  bootstrap: [AppComponent],
})
export class AppModule {}
