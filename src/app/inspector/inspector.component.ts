import { Component, OnInit, PipeTransform, Pipe, ChangeDetectionStrategy } from '@angular/core';
import { Command } from '../scripts/commands';
import { CanvasType } from '../CanvasType';
import { LayerStateService } from '../services';
import { Observable } from 'rxjs/Observable';
import 'rxjs/add/observable/combineLatest';

@Component({
  selector: 'app-inspector',
  templateUrl: './inspector.component.html',
  styleUrls: ['./inspector.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InspectorComponent implements OnInit {
  START_CANVAS = CanvasType.Start;
  END_CANVAS = CanvasType.End;
  subPathItemsObservable: Observable<[string, string]>;

  constructor(private layerStateService: LayerStateService) { }

  ngOnInit() {
    this.subPathItemsObservable = Observable.combineLatest(
      this.layerStateService.getActivePathIdObservable(CanvasType.Start),
      this.layerStateService.getActivePathIdObservable(CanvasType.End));
  }

  trackSubPath(index: number, item: SubPathItem) {
    return item.subIdx;
  }

  trackCommand(index: number, item: Command) {
    return item.getId();
  }
}

class SubPathItem {
  constructor(
    public readonly subIdx: number,
    public readonly startCmdItems: Command[] = [],
    public readonly endCmdItems: Command[] = [],
    public isExpanded = true) { }
}

@Pipe({ name: 'toSubPathItems' })
export class SubPathItemsPipe implements PipeTransform {
  constructor(private layerStateService: LayerStateService) { }

  transform(activePathIds: [string, string]): SubPathItem[] {
    const subPathItems: SubPathItem[] = [];

    const getPathFn = (canvasType: CanvasType) => {
      const pathLayer = this.layerStateService.getActivePathLayer(canvasType);
      if (!pathLayer) {
        return undefined;
      }
      return pathLayer.pathData;
    };

    const startPathCmd = getPathFn(CanvasType.Start);
    const endPathCmd = getPathFn(CanvasType.End);
    const numStartSubPaths = startPathCmd ? startPathCmd.getSubPaths().length : 0;
    const numEndSubPaths = endPathCmd ? endPathCmd.getSubPaths().length : 0;
    for (let i = 0; i < Math.max(numStartSubPaths, numEndSubPaths); i++) {
      const startCmdItems: Command[] = [];
      const endCmdItems: Command[] = [];
      if (i < numStartSubPaths) {
        startPathCmd.getSubPaths()[i].getCommands().forEach(command => {
          startCmdItems.push(command);
        });
      }
      if (i < numEndSubPaths) {
        endPathCmd.getSubPaths()[i].getCommands().forEach(command => {
          endCmdItems.push(command);
        });
      }
      // TODO: save the previous expanded state somehow?
      subPathItems.push(new SubPathItem(i, startCmdItems, endCmdItems));
    }
    return subPathItems;
  }
}
