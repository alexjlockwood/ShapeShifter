import {
  Component, OnChanges, SimpleChanges, Input, OnInit,
  EventEmitter, Output
} from '@angular/core';
import { DrawCommand, SubPathCommand, EditorType } from './../../scripts/model';
import { InspectorService, EventType } from '../inspector.service';

@Component({
  selector: 'app-subpath',
  templateUrl: './subpath.component.html',
  styleUrls: ['./subpath.component.scss']
})
export class SubPathComponent {
  @Input() editorType: EditorType;
  @Input() pathId: string;
  @Input() subPathIdx: number;

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
    this.inspectorService.notifyChange(EventType.Reverse, {
      pathId: this.pathId,
      subPathIdx: this.subPathIdx,
    });
  }

  onShiftBackClick() {
    this.inspectorService.notifyChange(EventType.ShiftBack, {
      pathId: this.pathId,
      subPathIdx: this.subPathIdx,
    });
  }

  onShiftForwardClick() {
    this.inspectorService.notifyChange(EventType.ShiftForward, {
      pathId: this.pathId,
      subPathIdx: this.subPathIdx,
    });
  }
}
