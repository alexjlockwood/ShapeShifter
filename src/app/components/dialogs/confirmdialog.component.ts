import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material';

import { Component } from '@angular/core';
import { Inject } from '@angular/core';

@Component({
  selector: 'app-confirmdialog',
  template: `
  <span matDialogTitle>{{ this.data.title }}</span>
  <mat-dialog-content>
    <p>{{ this.data.message }}</p>
  </mat-dialog-content>
  <mat-dialog-actions fxLayout="row">
    <!-- The ordering here matters (it ensures that 'OK' gets focus first). -->
    <span fxFlex></span>
    <button fxFlexOrder="2" mat-button (click)="dialogRef.close(true)">OK</button>
    <button fxFlexOrder="1" mat-button matDialogClose>Cancel</button>
  </mat-dialog-actions>`,
  styleUrls: ['./confirmdialog.component.scss'],
})
export class ConfirmDialogComponent {
  constructor(
    public readonly dialogRef: MatDialogRef<ConfirmDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public readonly data: { title: string; message: string },
  ) {}
}
