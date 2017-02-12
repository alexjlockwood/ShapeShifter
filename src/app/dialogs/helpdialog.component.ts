import { Component } from '@angular/core';
import { MdDialogRef } from '@angular/material';

@Component({
  selector: 'app-helpdialog',
  template: `
  <span md-dialog-title>Help</span>
  <md-dialog-content>
    <p>Subtitle</p>
    <p>TODO: write this</p>
  </md-dialog-content>
  <md-dialog-actions fxLayout="row">
    <span fxFlex></span>
    <button md-button (click)="dialogRef.close(true)">Got it</button>
  </md-dialog-actions>`,
  styleUrls: ['./helpdialog.component.scss'],
})
export class HelpDialogComponent {
  constructor(public readonly dialogRef: MdDialogRef<HelpDialogComponent>) {}
}
