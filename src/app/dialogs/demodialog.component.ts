import { Component } from '@angular/core';
import { MdDialogRef } from '@angular/material';

@Component({
  selector: 'app-demodialog',
  template: `
  <span md-dialog-title>Choose a demo</span>
  <md-radio-group class="example-radio-group" [(ngModel)]="selectedDemoTitle">
    <md-radio-button class="example-radio-button" *ngFor="let demoTitle of demoTitles" [value]="demoTitle">
      {{demoTitle}}
    </md-radio-button>
  </md-radio-group>
  <md-dialog-actions fxLayout="row" fxLayoutGap="8px">
    <!-- The ordering here matters (it ensures that 'OK' gets focus first). -->
    <span fxFlex></span>
    <button fxFlexOrder="2" md-button (click)="dialogRef.close(selectedDemoTitle)">OK</button>
    <button fxFlexOrder="1" md-button md-dialog-close>Cancel</button>
  </md-dialog-actions>`,
  styleUrls: ['./demodialog.component.scss'],
})
export class DemoDialogComponent {
  demoTitles = [];
  selectedDemoTitle: string;

  constructor(public readonly dialogRef: MdDialogRef<DemoDialogComponent>) {}
}
