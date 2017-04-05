import { Component, OnInit, PipeTransform, Pipe, ChangeDetectionStrategy } from '@angular/core';
import { SubPath, Command } from '../scripts/paths';
import { CanvasType } from '../CanvasType';
import { StateService, SelectionService, Selection } from '../services';
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
  subPathItemsObservable: Observable<[[string, string], ReadonlyArray<Selection>]>;

  constructor(
    private readonly stateService: StateService,
    private readonly selectionService: SelectionService,
  ) { }

  ngOnInit() {
    this.subPathItemsObservable =
      Observable.combineLatest(
        Observable.combineLatest(
          this.stateService.getActivePathIdObservable(CanvasType.Start),
          this.stateService.getActivePathIdObservable(CanvasType.End)),
        this.selectionService.asObservable());
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
    public readonly isStartSubPathSelected = false,
    public readonly isEndSubPathSelected = false,
  ) { }
}

@Pipe({ name: 'toSubPathItems' })
export class SubPathItemsPipe implements PipeTransform {
  constructor(
    private readonly stateService: StateService,
    private readonly selectionService: SelectionService,
  ) { }

  transform(items: [[string, string], { startSelections: number[], endSelections: number[] }]): SubPathItem[] {
    const subPathItems: SubPathItem[] = [];

    const getPathFn = (canvasType: CanvasType) => {
      const pathLayer = this.stateService.getActivePathLayer(canvasType);
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
      const isStartSubPathSelected =
        this.selectionService.isSubPathIndexSelected(CanvasType.Start, i);
      const isEndSubPathSelected =
        this.selectionService.isSubPathIndexSelected(CanvasType.End, i);
      subPathItems.push(
        new SubPathItem(
          i,
          startSubPaths[i],
          endSubPaths[i],
          id,
          startCmdItems,
          endCmdItems,
          isStartSubPathSelected || isEndSubPathSelected,
          isStartSubPathSelected || isEndSubPathSelected,
        ));
    }
    return subPathItems;
  }
}
