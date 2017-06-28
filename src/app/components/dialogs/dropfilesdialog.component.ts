import { Component } from '@angular/core';
import { MdDialogRef } from '@angular/material';

export enum DropFilesAction {
  AddToWorkspace = 1,
  ResetWorkspace,
}

@Component({
  selector: 'app-dropfilesdialog',
  template: `
  <span md-dialog-title>Start from scratch?</span>
  <md-dialog-content>
    <p>Do you want to start from scratch or add the imported layers to the existing animation?</p>
  </md-dialog-content>
  <md-dialog-actions fxLayout="row">
    <!-- The ordering here matters (it ensures that 'OK' gets focus first). -->
    <span fxFlex></span>
    <button fxFlexOrder="3" md-button (click)="dialogRef.close(this.ADD_TO_WORKSPACE)">Add layers</button>
    <button fxFlexOrder="2" md-button (click)="dialogRef.close(this.RESET_WORKSPACE)">Start from scratch</button>
    <button fxFlexOrder="1" md-button md-dialog-close>Cancel</button>
  </md-dialog-actions>`,
  styleUrls: ['./dropfilesdialog.component.scss'],
})
export class DropFilesDialogComponent {
  readonly ADD_TO_WORKSPACE = DropFilesAction.AddToWorkspace;
  readonly RESET_WORKSPACE = DropFilesAction.ResetWorkspace;

  constructor(public readonly dialogRef: MdDialogRef<DropFilesDialogComponent>) {}
}
