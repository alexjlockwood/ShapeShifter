import { Component, OnInit, PipeTransform, Pipe, ChangeDetectionStrategy } from '@angular/core';
import { SubPath, Command } from '../scripts/paths';
import { CanvasType } from '../CanvasType';
import {
  StateService, SelectionService, Selection, AppModeService, AppMode
} from '../services';
import { Observable } from 'rxjs/Observable';
import 'rxjs/add/observable/combineLatest';

// TODO: determine if we should disable this in some cases...
const SHOULD_SHOW_DETAILS = true;

@Component({
  selector: 'app-pathinspector',
  templateUrl: './pathinspector.component.html',
  styleUrls: ['./pathinspector.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PathInspectorComponent implements OnInit {
  START_CANVAS = CanvasType.Start;
  END_CANVAS = CanvasType.End;
  subPathItemsObservable: Observable<[string, string, ReadonlyArray<Selection>]>;
  shouldShowDetailsObservable: Observable<boolean>;

  constructor(
    private readonly stateService: StateService,
    private readonly selectionService: SelectionService,
    private readonly appModeService: AppModeService,
  ) { }

  ngOnInit() {
    this.subPathItemsObservable =
      Observable.combineLatest(
        this.stateService.getActivePathIdObservable(CanvasType.Start),
        this.stateService.getActivePathIdObservable(CanvasType.End),
        this.selectionService.asObservable());
    this.shouldShowDetailsObservable =
      this.appModeService.asObservable().map(appMode => {
        if (SHOULD_SHOW_DETAILS) {
          return true;
        }
        return appMode === AppMode.Selection || appMode === AppMode.SplitCommands;
      });
  }

  trackSubPath(index: number, item: SubPathItem) {
    return item.subPathItemId;
  }

  trackCommand(index: number, item: Command) {
    return item.getId();
  }
}

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

  transform(items: [string, string, ReadonlyArray<Selection>]): SubPathItem[] {
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
      const isSubPathSelected = this.selectionService.isSubPathIndexSelected(i);
      subPathItems.push(
        new SubPathItem(
          i,
          startSubPaths[i],
          endSubPaths[i],
          id,
          startCmdItems,
          endCmdItems,
          isSubPathSelected,
          isSubPathSelected,
        ));
    }
    return subPathItems;
  }
}
