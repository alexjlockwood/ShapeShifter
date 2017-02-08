import {
  Component, OnChanges, SimpleChanges, Input, OnInit,
  EventEmitter, Output
} from '@angular/core';
import { LayerStateService } from '../../services/layerstate.service';
import { Command, SubPathCommand, PathCommand } from '../../scripts/commands';
import { CanvasType } from '../../CanvasType';
import { InspectorService, EventType } from '../inspector.service';
import { VectorLayer, PathLayer } from '../../scripts/layers';

@Component({
  selector: 'app-subpath',
  templateUrl: './subpath.component.html',
  styleUrls: ['./subpath.component.scss']
})
export class SubPathComponent {
  @Input() canvasType: CanvasType;
  @Input() subIdx: number;
  private drawCommandWrappers_: DrawCommandWrapper[];

  constructor(
    private layerStateService: LayerStateService,
    private inspectorService: InspectorService) { }

  get pathCommand() {
    const vectorLayer = this.layerStateService.getVectorLayer(this.canvasType);
    const pathId = this.layerStateService.getActivePathId(this.canvasType);
    return (vectorLayer.findLayerById(pathId) as PathLayer).pathData;
  }

  get subPathCommand() {
    return this.pathCommand.subPathCommands[this.subIdx];
  }

  get drawCommandWrappers() {
    const dcws: DrawCommandWrapper[] = [];
    this.subPathCommand.commands.forEach((cmd, i) => {
      dcws.push({
        id: this.pathCommand.getId(this.subIdx, i),
        drawCommand: cmd,
      });
    });
    return dcws;
  }

  onAutoFixClick() {
    this.inspectorService.notifyChange(EventType.AutoFix, {
      subIdx: this.subIdx,
    });
  }

  onReverseClick() {
    this.inspectorService.notifyChange(EventType.Reverse, {
      subIdx: this.subIdx,
    });
  }

  onShiftBackClick() {
    this.inspectorService.notifyChange(EventType.ShiftBack, {
      subIdx: this.subIdx,
    });
  }

  onShiftForwardClick() {
    this.inspectorService.notifyChange(EventType.ShiftForward, {
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
