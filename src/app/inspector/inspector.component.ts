import {
  Component, Input, OnInit, ChangeDetectorRef,
  OnDestroy, NgZone, OnChanges, PipeTransform, Pipe
} from '@angular/core';
import { VectorLayer, PathLayer } from '../scripts/layers';
import { PathCommand, SubPathCommand, Command } from '../scripts/commands';
import { CanvasType } from '../CanvasType';
import { LayerStateService, Event as LayerStateEvent } from '../services/layerstate.service';
import { Subscription } from 'rxjs/Subscription';
import { AutoAwesome } from '../scripts/commands';
import { Observable } from 'rxjs/Observable';
import 'rxjs/add/observable/combineLatest';

@Component({
  selector: 'app-inspector',
  templateUrl: './inspector.component.html',
  styleUrls: ['./inspector.component.scss'],
})
export class InspectorComponent implements OnInit {
  START_CANVAS = CanvasType.Start;
  END_CANVAS = CanvasType.End;

  subPathCommandItemsObservable: Observable<[string, string]>;
  private readonly subscriptions: Subscription[] = [];

  constructor(private layerStateService: LayerStateService) { }

  ngOnInit() {
    this.subPathCommandItemsObservable = Observable.combineLatest(
      this.layerStateService.getActivePathIdObservable(CanvasType.Start),
      this.layerStateService.getActivePathIdObservable(CanvasType.End));
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

@Pipe({ name: 'toSubPathCommandItems' })
export class SubPathCommandItemsPipe implements PipeTransform {
  constructor(private layerStateService: LayerStateService) { }

  transform(activePathIds: [string, string]): SubPathCommandItem[] {
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
      // TODO: save the previous expanded state somehow?
      subPathCommandItems.push(new SubPathCommandItem(i, startCmdItems, endCmdItems));
    }
    return subPathCommandItems;
  }
}
