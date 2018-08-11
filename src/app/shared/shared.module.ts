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
 * reused across the application. It should not declare any singleton providers/services
 * (unless they are stateless).
 */
@NgModule({
  imports: [CommonModule, FlexLayoutModule, materialModules],
  declarations: [],
  exports: [CommonModule, FlexLayoutModule, materialModules],
})
export class SharedModule {}
