import { Component } from '@angular/core';
import { MdDialogRef } from '@angular/material';

@Component({
  selector: 'app-confirmdialog',
  template: `
  <span md-dialog-title>{{ title }}</span>
  <md-dialog-content>
    <p>{{ message }}</p>
  </md-dialog-content>
  <md-dialog-actions fxLayout="row" fxLayoutGap="8px">
    <span fxFlex></span>
    <button md-button md-dialog-close>Cancel</button>
    <button md-button (click)="dialogRef.close(true)">OK</button>
  </md-dialog-actions>`,
  styleUrls: ['./confirmdialog.component.scss'],
})
export class ConfirmDialogComponent {
  public title = '';
  public message = '';

  constructor(public readonly dialogRef: MdDialogRef<ConfirmDialogComponent>) {}
}
