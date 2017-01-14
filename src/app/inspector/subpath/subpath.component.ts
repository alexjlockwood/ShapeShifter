import { Component, OnChanges, SimpleChanges, Input, OnInit } from '@angular/core';
import { StateService, VectorLayerType } from './../../state.service';
import { IDrawCommand, ISubPathCommand } from './../../scripts/model';

@Component({
  selector: 'app-subpath',
  template: `
  <div fxLayout="row">
    <button md-icon-button
        mdTooltip="Reverse"
        mdTooltipPosition="above"
        md-theme="dark"
        (click)="onReverseClick()">
      <md-icon class="md-24">autorenew</md-icon>
    </button>

    <button md-icon-button
        mdTooltip="Shift back"
        mdTooltipPosition="above"
        md-theme="dark"
        [disabled]="!isSubPathClosed()"
        (click)="onShiftBackClick()">
    <md-icon class="md-24">skip_previous</md-icon>
    </button>

    <button md-icon-button
        mdTooltip="Shift forwards"
        mdTooltipPosition="above"
        md-theme="dark"
        [disabled]="!isSubPathClosed()"
        (click)="onShiftForwardClick()">
      <md-icon class="md-24">skip_next</md-icon>
    </button>
  </div>

  <app-command *ngFor="let drawCommand of drawCommands; let commandIndex = index"
      fxLayout="row"
      fxLayoutAlign="start center"
      [vectorLayerType]="vectorLayerType"
      [commandIndex]="commandIndex"
      [drawCommand]="drawCommand">
  </app-command>`,
  styleUrls: ['./subpath.component.scss']
})
export class SubPathComponent implements OnInit, OnChanges {
  @Input() vectorLayerType: VectorLayerType;
  private subPathCommand_: ISubPathCommand;
  drawCommands: ReadonlyArray<IDrawCommand> = [];

  constructor(private stateService: StateService) { }

  ngOnInit() {
    // console.log('ngOnInit()');
  }

  ngOnChanges(changes: SimpleChanges) {
    // console.log('subpath');
  }

  get subPathCommand() {
    return this.subPathCommand_;
  }

  @Input()
  set subPathCommand(subPathCommand: ISubPathCommand) {
    console.log('setting new sub path command');
    this.subPathCommand_ = subPathCommand;
    this.drawCommands = subPathCommand.commands;
  }

  isSubPathClosed() {
    return this.subPathCommand_.isClosed();
  }

  onReverseClick() {
    this.subPathCommand_.reverse();
    this.stateService.notifyVectorLayerChange(this.vectorLayerType);
  }

  onShiftBackClick() {
    this.subPathCommand_.shiftBack();
    this.stateService.notifyVectorLayerChange(this.vectorLayerType);
  }

  onShiftForwardClick() {
    this.subPathCommand_.shiftForward();
    this.stateService.notifyVectorLayerChange(this.vectorLayerType);
  }
}
