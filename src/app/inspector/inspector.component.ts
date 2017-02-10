import {
  Component, Input, OnInit, ChangeDetectorRef,
  OnDestroy, NgZone, OnChanges
} from '@angular/core';
import { VectorLayer, PathLayer } from '../scripts/layers';
import { PathCommand, SubPathCommand, Command } from '../scripts/commands';
import { CanvasType } from '../CanvasType';
import { LayerStateService } from '../services/layerstate.service';
import { Subscription } from 'rxjs/Subscription';
import { AutoAwesome } from '../scripts/common';

// Note: this needs to stay in sync with the constants declared in scss.
const COMMAND_LIST_ITEM_HEIGHT = 20;

@Component({
  selector: 'app-inspector',
  templateUrl: './inspector.component.html',
  styleUrls: ['./inspector.component.scss'],
})
export class InspectorComponent {
  START_CANVAS = CanvasType.Start;
  END_CANVAS = CanvasType.End;

  // TODO: possible for # of subpaths to change?
  private readonly collapsedSubPathIndices: Set<number> = new Set();

  constructor(private layerStateService: LayerStateService) { }

  getSubPathCommands(canvasType: CanvasType) {
    const pathLayer = this.layerStateService.getActivePathLayer(canvasType);
    return pathLayer ? pathLayer.pathData.subPathCommands : [];
  }

  private getPathCommand(canvasType: CanvasType) {
    const vectorLayer = this.layerStateService.getVectorLayer(canvasType);
    const pathId = this.layerStateService.getActivePathId(canvasType);
    return (vectorLayer.findLayerById(pathId) as PathLayer).pathData;
  }

  getCommandWrappers(canvasType: CanvasType, subIdx: number) {
    const cws: CommandWrapper[] = [];
    const pathCommand = this.getPathCommand(canvasType);
    pathCommand.subPathCommands[subIdx].commands.forEach((command, cmdIdx) => {
      const id = pathCommand.getId(subIdx, cmdIdx);
      cws.push({ id, command });
    });
    return cws;
  }

  toggleExpandedState(subIdx: number) {
    console.log('subIdx=' + subIdx);
    if (this.collapsedSubPathIndices.has(subIdx)) {
      this.collapsedSubPathIndices.delete(subIdx);
    } else {
      this.collapsedSubPathIndices.add(subIdx);
    }
  }

  isExpanded(subIdx: number) {
    return !this.collapsedSubPathIndices.has(subIdx);
  }

  areStartAndEndPathsLoaded() {
    return this.layerStateService.getActivePathId(CanvasType.Start)
      && this.layerStateService.getActivePathId(CanvasType.End);
  }

  getPlaceholderHeight(canvasType: CanvasType, subIdx: number) {
    if (!this.layerStateService.getActivePathId(CanvasType.Start)
      || !this.layerStateService.getActivePathId(CanvasType.End)) {
      return 0;
    }
    const numStart = this.getCommandWrappers(CanvasType.Start, subIdx).length;
    const numEnd = this.getCommandWrappers(CanvasType.End, subIdx).length;
    const difference = Math.abs(numStart - numEnd);
    if ((numStart < numEnd && canvasType === CanvasType.Start)
      || (numStart > numEnd && canvasType === CanvasType.End)) {
      return (difference * 20) + 'px';
    }
    return 0;
  }

  trackSubPathCommand(index: number, item: SubPathCommand) {
    // TODO: will need to change this if/when we support reordering subpaths
    return index;
  }

  trackCommand(index: number, item: CommandWrapper) {
    return item.id;
  }
}

interface CommandWrapper {
  id: string;
  command: Command;
}
