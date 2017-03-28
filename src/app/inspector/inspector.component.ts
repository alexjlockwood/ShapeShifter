import { Component, OnInit, PipeTransform, Pipe, ChangeDetectionStrategy } from '@angular/core';
import { SubPath, Command } from '../scripts/commands';
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

  constructor(private readonly layerStateService: LayerStateService) { }

  ngOnInit() {
    this.subPathItemsObservable = Observable.combineLatest(
      this.layerStateService.getActivePathIdObservable(CanvasType.Start),
      this.layerStateService.getActivePathIdObservable(CanvasType.End));
  }

  trackSubPath(index: number, item: SubPathItem) {
    return item.subPathItemId;
  }

  trackCommand(index: number, item: Command) {
    return item.getId();
  }
}

// TODO: save the previous expanded state somehow?
class SubPathItem {
  constructor(
    public readonly subIdx: number,
    public readonly startSubPath: SubPath,
    public readonly endSubPath: SubPath,
    public readonly subPathItemId: string,
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
    const startSubPaths =
      startPathCmd ? startPathCmd.getSubPaths().filter(s => !s.isCollapsing()) : [];
    const endSubPaths =
      endPathCmd ? endPathCmd.getSubPaths().filter(s => !s.isCollapsing()) : [];
    const numStartSubPaths = startSubPaths.length;
    const numEndSubPaths = endSubPaths.length;
    for (let i = 0; i < Math.max(numStartSubPaths, numEndSubPaths); i++) {
      const startCmdItems: Command[] = [];
      const endCmdItems: Command[] = [];
      let id = '';
      if (i < numStartSubPaths) {
        id += startSubPaths[i].getId();
        startCmdItems.push(...startSubPaths[i].getCommands());
      }
      id += ',';
      if (i < numEndSubPaths) {
        id += endSubPaths[i].getId();
        endCmdItems.push(...endSubPaths[i].getCommands());
      }
      subPathItems.push(
        new SubPathItem(
          i,
          startSubPaths[i],
          endSubPaths[i],
          id,
          startCmdItems,
          endCmdItems));
    }
    return subPathItems;
  }
}
