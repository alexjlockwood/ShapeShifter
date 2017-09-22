import { Component } from '@angular/core';
import { MatDialogRef } from '@angular/material';

export enum DropFilesAction {
  AddToWorkspace = 1,
  ResetWorkspace,
}

@Component({
  selector: 'app-dropfilesdialog',
  template: `
  <span matDialogTitle>Start from scratch?</span>
  <mat-dialog-content>
    <p>Do you want to start from scratch or add the imported layers to the existing animation?</p>
  </mat-dialog-content>
  <mat-dialog-actions fxLayout="row">
    <!-- The ordering here matters (it ensures that 'OK' gets focus first). -->
    <span fxFlex></span>
    <button fxFlexOrder="3" mat-button (click)="dialogRef.close(this.ADD_TO_WORKSPACE)">Add layers</button>
    <button fxFlexOrder="2" mat-button (click)="dialogRef.close(this.RESET_WORKSPACE)">Start from scratch</button>
    <button fxFlexOrder="1" mat-button matDialogClose>Cancel</button>
  </mat-dialog-actions>`,
  styleUrls: ['./dropfilesdialog.component.scss'],
})
export class DropFilesDialogComponent {
  readonly ADD_TO_WORKSPACE = DropFilesAction.AddToWorkspace;
  readonly RESET_WORKSPACE = DropFilesAction.ResetWorkspace;

  constructor(public readonly dialogRef: MatDialogRef<DropFilesDialogComponent>) {}
}
