import { Component } from '@angular/core';
import { MdDialogRef } from '@angular/material';

@Component({
  selector: 'app-confirmdialog',
  template: `
  <span md-dialog-title>{{ title }}</span>
  <md-dialog-content>
    <p>{{ message }}</p>
  </md-dialog-content>
  <md-dialog-actions fxLayout="row">
    <!-- The ordering here matters (it ensures that 'OK' gets focus first). -->
    <span fxFlex></span>
    <button fxFlexOrder="2" md-button (click)="dialogRef.close(true)">OK</button>
    <button fxFlexOrder="1" md-button md-dialog-close>Cancel</button>
  </md-dialog-actions>`,
  styleUrls: ['./confirmdialog.component.scss'],
})
export class ConfirmDialogComponent {
  title = '';
  message = '';

  constructor(public readonly dialogRef: MdDialogRef<ConfirmDialogComponent>) {}
}
