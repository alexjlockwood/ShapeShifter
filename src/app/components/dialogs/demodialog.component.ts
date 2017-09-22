import { Component } from '@angular/core';
import { MatDialogRef } from '@angular/material';
import { DEMO_INFOS } from 'app/scripts/demos';

@Component({
  selector: 'app-demodialog',
  template: `
  <span matDialogTitle>Choose a demo</span>
  <mat-radio-group class="dialog-radio-group" [(ngModel)]="this.selectedDemoInfo">
    <mat-radio-button class="dialog-radio-button"
      *ngFor="let demoInfo of this.demoInfos" [value]="demoInfo">
      {{ demoInfo.title }}
    </mat-radio-button>
  </mat-radio-group>
  <mat-dialog-actions fxLayout="row">
    <!-- The ordering here matters (it ensures that 'OK' gets focus first). -->
    <span fxFlex></span>
    <button fxFlexOrder="2" mat-button (click)="this.dialogRef.close(this.selectedDemoInfo)">OK</button>
    <button fxFlexOrder="1" mat-button matDialogClose>Cancel</button>
  </mat-dialog-actions>`,
  styleUrls: ['./demodialog.component.scss'],
})
export class DemoDialogComponent {
  readonly demoInfos = DEMO_INFOS;
  selectedDemoInfo = DEMO_INFOS[0];

  constructor(public readonly dialogRef: MatDialogRef<DemoDialogComponent>) {}
}
