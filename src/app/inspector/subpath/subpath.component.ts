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
  @Input() subPathCommand: SubPathCommand;

  constructor(private inspectorService: InspectorService) { }

  get drawCommands() {
    return this.subPathCommand.commands;
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
  trackDrawCommand(index: number, item: DrawCommand) {
    return `${index}_${item.commandString}`;
  }
}
