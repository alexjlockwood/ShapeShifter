import {
  Component, OnChanges, SimpleChanges, Input, OnInit,
  EventEmitter, Output
} from '@angular/core';
import { DrawCommand, SubPathCommand, PathCommand, EditorType } from './../../scripts/model';
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
  @Input() pathCommand: PathCommand;
  private subPathCommand_: SubPathCommand;
  private drawCommandWrappers_: DrawCommandWrapper[];

  constructor(private inspectorService: InspectorService) { }

  @Input()
  set subPathCommand(subPathCommand: SubPathCommand) {
    this.subPathCommand_ = subPathCommand;
    const dcws = [];
    this.subPathCommand_.commands.forEach((cmd, i) => {
      dcws.push({
        id: this.pathCommand.getId(this.subPathIdx, i),
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

  onAutoAlignClick() {
    this.inspectorService.notifyChange(EventType.AutoAlign, {
      pathId: this.pathId,
      subPathIdx: this.subPathIdx,
    });
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

  // TODO: this doesn't work when the item is changing from deleted to not deleted etc.
  // need to make sure this accurately reflects the appearance of the item in the UI so
  // it always updates.
  trackDrawCommand(index: number, item: DrawCommandWrapper) {
    return item.id;
  }
}

interface DrawCommandWrapper {
  id: string;
  drawCommand: DrawCommand;
}
