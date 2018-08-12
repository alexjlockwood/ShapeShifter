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

import { HeaderComponent } from './components/header/header.component';
import { ProjectGridComponent } from './components/projectgrid/projectgrid.component';

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
  imports: [CommonModule, FlexLayoutModule, materialModules, RouterModule],
  declarations: [HeaderComponent, ProjectGridComponent],
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
