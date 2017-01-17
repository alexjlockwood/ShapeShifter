import {
  Component, OnChanges, SimpleChanges, Input, OnInit,
  EventEmitter, Output
} from '@angular/core';
import { DrawCommand, SubPathCommand } from './../../scripts/model';
import { InspectorService, EventType } from '../inspector.service';

@Component({
  selector: 'app-subpath',
  templateUrl: './subpath.component.html',
  styleUrls: ['./subpath.component.scss']
})
export class SubPathComponent {
  @Input('pathCommandIndex') pathCommandIndex: number;
  @Input('subPathCommandIndex') subPathCommandIndex: number;

  // Draw commands to use to populate the ngFor loop of command components.
  drawCommands: ReadonlyArray<DrawCommand> = [];
  private subPathCommand_: SubPathCommand;

  constructor(private inspectorService: InspectorService) { }

  @Input()
  set subPathCommand(subPathCommand: SubPathCommand) {
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
