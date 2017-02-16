import {
  Component, Input, OnInit, ChangeDetectorRef,
  OnDestroy, NgZone, OnChanges
} from '@angular/core';
import { VectorLayer, PathLayer } from '../scripts/layers';
import { PathCommand, SubPathCommand, Command } from '../scripts/commands';
import { CanvasType } from '../CanvasType';
import { LayerStateService, Event as LayerStateEvent } from '../services/layerstate.service';
import { Subscription } from 'rxjs/Subscription';
import { AutoAwesome } from '../scripts/common';

@Component({
  selector: 'app-inspector',
  templateUrl: './inspector.component.html',
  styleUrls: ['./inspector.component.scss'],
})
export class InspectorComponent implements OnInit, OnDestroy {
  START_CANVAS = CanvasType.Start;
  END_CANVAS = CanvasType.End;

  subPathCommandItems: SubPathCommandItem[] = [];
  private readonly subscriptions: Subscription[] = [];

  constructor(private layerStateService: LayerStateService) { }

  ngOnInit() {
    [CanvasType.Start, CanvasType.End].forEach(type => {
      this.subscriptions.push(this.layerStateService.addListener(
        type, (event: LayerStateEvent) => {
          this.rebuildSubPathCommandItems();
        }));
    });
  }

  ngOnDestroy() {
    this.subscriptions.forEach(s => s.unsubscribe());
  }

  private rebuildSubPathCommandItems() {
    const subPathCommandItems: SubPathCommandItem[] = [];

    const getPathCommandFn = (canvasType: CanvasType) => {
      const pathLayer = this.layerStateService.getActivePathLayer(canvasType);
      if (!pathLayer) {
        return undefined;
      }
      return pathLayer.pathData;
    };

    const startPathCmd = getPathCommandFn(CanvasType.Start);
    const endPathCmd = getPathCommandFn(CanvasType.End);
    const numStartSubPaths = startPathCmd ? startPathCmd.subPathCommands.length : 0;
    const numEndSubPaths = endPathCmd ? endPathCmd.subPathCommands.length : 0;
    for (let i = 0; i < Math.max(numStartSubPaths, numEndSubPaths); i++) {
      const startCmdItems: CommandItem[] = [];
      const endCmdItems: CommandItem[] = [];
      if (i < numStartSubPaths) {
        startPathCmd.subPathCommands[i].commands.forEach((command, cmdIdx) => {
          const id = startPathCmd.getId(i, cmdIdx);
          startCmdItems.push({ id, command });
        });
      }
      if (i < numEndSubPaths) {
        endPathCmd.subPathCommands[i].commands.forEach((command, cmdIdx) => {
          const id = endPathCmd.getId(i, cmdIdx);
          endCmdItems.push({ id, command });
        });
      }
      const currItems = this.subPathCommandItems;
      const wasExpanded = i < currItems.length ? currItems[i].isExpanded : true;
      subPathCommandItems.push(
        new SubPathCommandItem(i, startCmdItems, endCmdItems, wasExpanded));
    }
    this.subPathCommandItems = subPathCommandItems;
  }

  toggleExpandedState(subIdx: number) {
    this.subPathCommandItems[subIdx].isExpanded = !this.isExpanded(subIdx);
  }

  isExpanded(subIdx: number) {
    return this.subPathCommandItems[subIdx].isExpanded;
  }

  trackSubPathCommand(index: number, item: SubPathCommandItem) {
    return item.subIdx;
  }

  trackCommand(index: number, item: CommandItem) {
    return item.id;
  }
}

class SubPathCommandItem {
  constructor(
    public readonly subIdx: number,
    public readonly startCmdItems: CommandItem[] = [],
    public readonly endCmdItems: CommandItem[] = [],
    public isExpanded = true) { }
}

class CommandItem {
  constructor(
    public readonly id: string,
    public readonly command: Command) { }
}
