import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FlexLayoutModule } from '@angular/flex-layout';
import {
  MatButtonModule,
  MatDialogModule,
  MatIconModule,
  MatInputModule,
  MatMenuModule,
  MatOptionModule,
  MatRadioModule,
  MatSlideToggleModule,
  MatSnackBarModule,
  MatToolbarModule,
  MatTooltipModule,
} from '@angular/material';
import { RouterModule } from '@angular/router';
import { LottieAnimationViewModule } from 'ng-lottie';

import { HeaderComponent } from './components/header';
import { ProjectGridComponent } from './components/project-grid';
import { SigninDialogComponent } from './components/signin-dialog';
import { SignoutDialogComponent } from './components/signout-dialog';

const materialModules = [
  MatButtonModule,
  MatDialogModule,
  MatIconModule,
  MatInputModule,
  MatMenuModule,
  MatOptionModule,
  MatRadioModule,
  MatSlideToggleModule,
  MatSnackBarModule,
  MatToolbarModule,
  MatTooltipModule,
];

/**
 * The SharedModule should contain reusable components, directives, pipes, etc. that are
 * reused across the application. It should not declare any singleton, stateful providers.
 */
@NgModule({
  imports: [
    CommonModule,
    FlexLayoutModule,
    LottieAnimationViewModule.forRoot(),
    materialModules,
    RouterModule,
  ],
  declarations: [
    HeaderComponent,
    ProjectGridComponent,
    SigninDialogComponent,
    SignoutDialogComponent,
  ],
  entryComponents: [SigninDialogComponent, SignoutDialogComponent],
  exports: [
    CommonModule,
    FlexLayoutModule,
    HeaderComponent,
    materialModules,
    ProjectGridComponent,
    RouterModule,
  ],
})
export class SharedModule {}
