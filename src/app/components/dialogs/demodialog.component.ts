import { Component } from '@angular/core';
import { MdDialogRef } from '@angular/material';
import { DEMO_INFOS } from 'app/scripts/demos';

@Component({
  selector: 'app-demodialog',
  template: `
  <span md-dialog-title>Choose a demo</span>
  <md-radio-group class="dialog-radio-group" [(ngModel)]="this.selectedDemoInfo">
    <md-radio-button class="dialog-radio-button"
      *ngFor="let demoInfo of this.demoInfos" [value]="demoInfo">
      {{ demoInfo.title }}
    </md-radio-button>
  </md-radio-group>
  <md-dialog-actions fxLayout="row">
    <!-- The ordering here matters (it ensures that 'OK' gets focus first). -->
    <span fxFlex></span>
    <button fxFlexOrder="2" md-button (click)="this.dialogRef.close(this.selectedDemoInfo)">OK</button>
    <button fxFlexOrder="1" md-button md-dialog-close>Cancel</button>
  </md-dialog-actions>`,
  styleUrls: ['./demodialog.component.scss'],
})
export class DemoDialogComponent {
  readonly demoInfos = DEMO_INFOS;
  selectedDemoInfo = DEMO_INFOS[0];

  constructor(public readonly dialogRef: MdDialogRef<DemoDialogComponent>) {}
}
