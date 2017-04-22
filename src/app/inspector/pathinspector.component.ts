import { Component, OnInit, PipeTransform, Pipe, ChangeDetectionStrategy } from '@angular/core';
import { SubPath, Command } from '../scripts/paths';
import { CanvasType } from '../CanvasType';
import {
  StateService,
  SelectionService, Selection, SelectionType,
  AppModeService,
  HoverService, Hover,
} from '../services';
import { Observable } from 'rxjs/Observable';
import 'rxjs/add/observable/combineLatest';

@Component({
  selector: 'app-pathinspector',
  templateUrl: './pathinspector.component.html',
  styleUrls: ['./pathinspector.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PathInspectorComponent implements OnInit {
  readonly START_CANVAS = CanvasType.Start;
  readonly END_CANVAS = CanvasType.End;

  pathInspectorObservable: Observable<[string, string, ReadonlyArray<Selection>, Hover]>;

  constructor(
    private readonly stateService: StateService,
    private readonly selectionService: SelectionService,
    private readonly appModeService: AppModeService,
    private readonly hoverService: HoverService,
  ) { }

  ngOnInit() {
    this.pathInspectorObservable =
      Observable.combineLatest(
        this.stateService.getActivePathIdObservable(CanvasType.Start),
        this.stateService.getActivePathIdObservable(CanvasType.End),
        this.selectionService.asObservable(),
        this.hoverService.asObservable());
  }

  trackSubPathPair(index: number, item: SubPathPair) {
    return item.subPathPairId;
  }

  trackCommand(index: number, item: Command) {
    return item.getId();
  }
}

class SubPathPair {
  constructor(
    public readonly subPathPairId: string,
    public readonly startSubPath: SubPath,
    public readonly endSubPath: SubPath,
    public readonly startCmds: Command[] = [],
    public readonly endCmds: Command[] = [],
    public readonly isStartSubPathSelected = false,
    public readonly isEndSubPathSelected = false,
  ) { }
}

@Pipe({ name: 'toSubPathPairs' })
export class SubPathPairsPipe implements PipeTransform {
  constructor(private readonly stateService: StateService) { }

  transform(items: [string, string, ReadonlyArray<Selection>, Hover]): SubPathPair[] {
    const subPathPairs: SubPathPair[] = [];

    const getPathFn = (canvasType: CanvasType) => {
      const pathLayer = this.stateService.getActivePathLayer(canvasType);
      if (!pathLayer) {
        return undefined;
      }
      return pathLayer.pathData;
    };

    const startPath = getPathFn(CanvasType.Start);
    const endPath = getPathFn(CanvasType.End);
    const startSubPaths =
      startPath ? startPath.getSubPaths().filter(s => !s.isCollapsing()) : [];
    const endSubPaths =
      endPath ? endPath.getSubPaths().filter(s => !s.isCollapsing()) : [];
    const numStartSubPaths = startSubPaths.length;
    const numEndSubPaths = endSubPaths.length;
    for (let subIdx = 0; subIdx < Math.max(numStartSubPaths, numEndSubPaths); subIdx++) {
      const startCmds: Command[] = [];
      const endCmds: Command[] = [];
      let pairId = '';
      if (subIdx < numStartSubPaths) {
        pairId += startSubPaths[subIdx].getId();
        startCmds.push(...startSubPaths[subIdx].getCommands());
      }
      pairId += ',';
      if (subIdx < numEndSubPaths) {
        pairId += endSubPaths[subIdx].getId();
        endCmds.push(...endSubPaths[subIdx].getCommands());
      }
      const selections = items[2].slice();
      const hover = items[3];
      if (hover) {
        const { subIdx: hoverSubIdx, source: hoverSource } = hover;
        selections.push({
          subIdx: hoverSubIdx,
          source: hoverSource,
          type: SelectionType.SubPath,
        });
      }
      const isStartSubPathSelected = selections.some(s => {
        return s.source === CanvasType.Start && s.subIdx === subIdx;
      });
      const isEndSubPathSelected = selections.some(s => {
        return s.source === CanvasType.End && s.subIdx === subIdx;
      });
      subPathPairs.push(
        new SubPathPair(
          pairId,
          startSubPaths[subIdx],
          endSubPaths[subIdx],
          startCmds,
          endCmds,
          isStartSubPathSelected,
          isEndSubPathSelected,
        ));
    }
    return subPathPairs;
  }
}
