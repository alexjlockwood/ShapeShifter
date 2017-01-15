import {
  Component, OnChanges, SimpleChanges, Input, OnInit,
  EventEmitter, Output
} from '@angular/core';
import { IDrawCommand, ISubPathCommand } from './../../scripts/model';
import { InspectorService, EventType } from '../inspector.service';

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
        [disabled]="!subPathCommand.isClosed"
        (click)="onShiftBackClick()">
    <md-icon class="md-24">skip_previous</md-icon>
    </button>

    <button md-icon-button
        mdTooltip="Shift forwards"
        mdTooltipPosition="above"
        md-theme="dark"
        [disabled]="!subPathCommand.isClosed"
        (click)="onShiftForwardClick()">
      <md-icon class="md-24">skip_next</md-icon>
    </button>
  </div>

  <app-command *ngFor="let command of drawCommands; let commandIndex = index"
      fxLayout="row"
      fxLayoutAlign="start center"
      [pathCommandIndex]="pathCommandIndex"
      [subPathCommandIndex]="subPathCommandIndex"
      [drawCommandIndex]="commandIndex"
      [drawCommand]="command">
  </app-command>`,
  styleUrls: ['./subpath.component.scss']
})
export class SubPathComponent implements OnInit, OnChanges {
  @Input('pathCommandIndex') pathCommandIndex: number;
  @Input('subPathCommandIndex') subPathCommandIndex: number;

  // Draw commands to use to populate the ngFor loop of command components.
  drawCommands: ReadonlyArray<IDrawCommand> = [];
  private subPathCommand_: ISubPathCommand;

  constructor(private inspectorService: InspectorService) { }

  ngOnInit() {
    // console.log('ngOnInit()');
  }

  ngOnChanges(changes: SimpleChanges) {
    // console.log('subpath');
  }

  @Input()
  set subPathCommand(subPathCommand: ISubPathCommand) {
    // console.log('setting new sub path command');
    this.subPathCommand_ = subPathCommand;
    this.drawCommands = subPathCommand.commands;
  }

  get subPathCommand() {
    return this.subPathCommand_;
  }

  onReverseClick() {
    this.inspectorService.notifyChange({
      eventType: EventType.Reverse,
      pathCommandIndex: this.pathCommandIndex,
      subPathCommandIndex: this.subPathCommandIndex,
    });
  }

  onShiftBackClick() {
    this.inspectorService.notifyChange({
      eventType: EventType.ShiftBack,
      pathCommandIndex: this.pathCommandIndex,
      subPathCommandIndex: this.subPathCommandIndex,
    });
  }

  onShiftForwardClick() {
    this.inspectorService.notifyChange({
      eventType: EventType.ShiftForward,
      pathCommandIndex: this.pathCommandIndex,
      subPathCommandIndex: this.subPathCommandIndex,
    });
  }
}
