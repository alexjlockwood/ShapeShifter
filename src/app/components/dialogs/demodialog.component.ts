import {
  ChangeDetectionStrategy,
  Component,
} from '@angular/core';
import { MdDialogRef } from '@angular/material';

@Component({
  selector: 'app-demodialog',
  template: `
  <span md-dialog-title>Choose a demo</span>
  <md-radio-group class="dialog-radio-group" [(ngModel)]="selectedDemoTitle">
    <md-radio-button class="dialog-radio-button"
      *ngFor="let demoTitle of demoTitles" [value]="demoTitle">
      {{demoTitle}}
    </md-radio-button>
  </md-radio-group>
  <md-dialog-actions fxLayout="row">
    <!-- The ordering here matters (it ensures that 'OK' gets focus first). -->
    <span fxFlex></span>
    <button fxFlexOrder="2" md-button (click)="dialogRef.close(selectedDemoTitle)">OK</button>
    <button fxFlexOrder="1" md-button md-dialog-close>Cancel</button>
  </md-dialog-actions>`,
  styleUrls: ['./demodialog.component.scss'],
  // TODO: make this OnPush
  // changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DemoDialogComponent {
  private demoTitles_: string[] = [];
  selectedDemoTitle: string;

  constructor(public readonly dialogRef: MdDialogRef<DemoDialogComponent>) { }

  get demoTitles() {
    return this.demoTitles_;
  }

  set demoTitles(demoTitles: string[]) {
    this.demoTitles_ = demoTitles.slice();
    this.selectedDemoTitle = demoTitles.length ? demoTitles[0] : undefined;
  }
}
