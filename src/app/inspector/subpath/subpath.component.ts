import {
  Component, OnChanges, SimpleChanges, Input, OnInit,
  EventEmitter, Output
} from '@angular/core';
import { Command, SubPathCommand, PathCommand } from './../../scripts/commands';
import { EditorType } from '../../EditorType';
import { InspectorService, EventType } from '../inspector.service';

@Component({
  selector: 'app-subpath',
  templateUrl: './subpath.component.html',
  styleUrls: ['./subpath.component.scss']
})
export class SubPathComponent {
  @Input() editorType: EditorType;
  @Input() pathId: string;
  @Input() subIdx: number;
  @Input() pathCommand: PathCommand;
  private subPathCommand_: SubPathCommand;
  private drawCommandWrappers_: DrawCommandWrapper[];

  constructor(private inspectorService: InspectorService) { }

  @Input()
  set subPathCommand(subPathCommand: SubPathCommand) {
    this.subPathCommand_ = subPathCommand;
    const dcws: DrawCommandWrapper[] = [];
    this.subPathCommand_.commands.forEach((cmd, i) => {
      dcws.push({
        id: this.pathCommand.getId(this.subIdx, i),
        drawCommand: cmd,
      });
    });
    this.drawCommandWrappers = dcws;
  }

  get subPathCommand() {
    return this.subPathCommand_;
  }

  set drawCommandWrappers(drawCommandWrappers: DrawCommandWrapper[]) {
    this.drawCommandWrappers_ = drawCommandWrappers;
  }

  get drawCommandWrappers() {
    return this.drawCommandWrappers_;
  }

  onAutoFixClick() {
    this.inspectorService.notifyChange(EventType.AutoFix, {
      pathId: this.pathId,
      subIdx: this.subIdx,
    });
  }

  onReverseClick() {
    this.inspectorService.notifyChange(EventType.Reverse, {
      pathId: this.pathId,
      subIdx: this.subIdx,
    });
  }

  onShiftBackClick() {
    this.inspectorService.notifyChange(EventType.ShiftBack, {
      pathId: this.pathId,
      subIdx: this.subIdx,
    });
  }

  onShiftForwardClick() {
    this.inspectorService.notifyChange(EventType.ShiftForward, {
      pathId: this.pathId,
      subIdx: this.subIdx,
    });
  }

  trackDrawCommand(index: number, item: DrawCommandWrapper) {
    return item.id;
  }
}

interface DrawCommandWrapper {
  id: string;
  drawCommand: Command;
}
