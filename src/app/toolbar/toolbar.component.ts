import * as _ from 'lodash';
import { Component, OnInit, ViewContainerRef, ChangeDetectionStrategy } from '@angular/core';
import {
  StateService,
  MorphStatus,
  SettingsService,
  SelectionService,
  Selection,
  SelectionType,
  HoverService,
  HoverType,
  AppModeService,
  AppMode,
  MorphSubPathService,
} from '../services';
import {
  deleteSelectedSplitSubPath,
  deleteSelectedSplitSegment,
  deleteSelectedSplitPoints,
} from '../services/selection.service';
import { CanvasType } from '../CanvasType';
import { ExportUtil } from '../scripts/export';
import { DialogService } from '../dialogs';
import { AutoAwesome } from '../scripts/algorithms';
import { DemoUtil, DEMO_MAP } from '../scripts/demos';
import { Observable } from 'rxjs/Observable';
import 'rxjs/add/observable/combineLatest';

declare const ga: Function;

@Component({
  selector: 'app-toolbar',
  templateUrl: './toolbar.component.html',
  styleUrls: ['./toolbar.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ToolbarComponent implements OnInit {
  readonly MORPH_NONE = MorphStatus.None;
  readonly MORPH_UNMORPHABLE = MorphStatus.Unmorphable;
  readonly MORPH_MORPHABLE = MorphStatus.Morphable;

  // This boolean is used to ensure the toolbar transition doesn't run on page load.
  hasActionModeBeenEnabled = false;

  morphStatusObservable: Observable<MorphStatus>;
  isDirtyObservable: Observable<boolean>;
  toolbarObservable: Observable<ToolbarData>;

  constructor(
    private readonly viewContainerRef: ViewContainerRef,
    private readonly settingsService: SettingsService,
    private readonly selectionService: SelectionService,
    private readonly hoverService: HoverService,
    private readonly stateService: StateService,
    private readonly appModeService: AppModeService,
    private readonly dialogService: DialogService,
    private readonly morphSubPathService: MorphSubPathService,
  ) { }

  ngOnInit() {
    this.morphStatusObservable = this.stateService.getMorphStatusObservable();
    this.isDirtyObservable =
      this.stateService.getExistingPathIdsObservable().map(ids => !!ids.length);
    const combinedObservable =
      Observable.combineLatest(
        this.selectionService.asObservable(),
        this.appModeService.asObservable(),
        this.morphSubPathService.asObservable());
    this.toolbarObservable = combinedObservable.map(() => {
      const selections = this.selectionService.getSelections();
      const appMode = this.appModeService.getAppMode();
      const selectionInfo =
        new ToolbarData(this.stateService, this.morphSubPathService, appMode, selections);
      if (selectionInfo.getNumSelections() > 0) {
        this.hasActionModeBeenEnabled = true;
      }
      return selectionInfo;
    });
  }

  shouldShowActionMode() {
    return this.selectionService.getSelections().length
      || this.appModeService.getAppMode() !== AppMode.Selection;
  }

  onNewClick() {
    ga('send', 'event', 'General', 'New click');

    this.dialogService
      .confirm(this.viewContainerRef, 'Start over?', 'You\'ll lose any unsaved changes.')
      .subscribe(result => {
        if (!result) {
          return;
        }
        this.stateService.reset();
      });
  }

  onAutoFixClick() {
    ga('send', 'event', 'General', 'Auto fix click');

    let resultStartCmd = this.stateService.getActivePathLayer(CanvasType.Start).pathData;
    let resultEndCmd = this.stateService.getActivePathLayer(CanvasType.End).pathData;
    const numSubPaths =
      Math.min(resultStartCmd.getSubPaths().length, resultEndCmd.getSubPaths().length);
    for (let subIdx = 0; subIdx < numSubPaths; subIdx++) {
      // Pass the command with the larger subpath as the 'from' command.
      const numStartCmds = resultStartCmd.getSubPath(subIdx).getCommands().length;
      const numEndCmds = resultEndCmd.getSubPath(subIdx).getCommands().length;
      const fromCmd = numStartCmds >= numEndCmds ? resultStartCmd : resultEndCmd;
      const toCmd = numStartCmds >= numEndCmds ? resultEndCmd : resultStartCmd;
      const { from, to } = AutoAwesome.autoFix(subIdx, fromCmd, toCmd);
      resultStartCmd = numStartCmds >= numEndCmds ? from : to;
      resultEndCmd = numStartCmds >= numEndCmds ? to : from;
    }
    this.stateService.updateActivePath(CanvasType.Start, resultStartCmd, false);
    this.stateService.updateActivePath(CanvasType.End, resultEndCmd, false);
    this.stateService.notifyChange(CanvasType.Preview);
    this.stateService.notifyChange(CanvasType.Start);
    this.stateService.notifyChange(CanvasType.End);
  }

  onExportClick() {
    ga('send', 'event', 'Export', 'Export click');
    const duration = this.settingsService.getDuration();
    const interpolator = this.settingsService.getInterpolator();
    ExportUtil.generateZip(this.stateService, duration, interpolator);
  }

  onDemoClick() {
    ga('send', 'event', 'Demos', 'Demos dialog shown');
    const demoTitles = Array.from(DEMO_MAP.keys());
    this.dialogService
      .demo(this.viewContainerRef, demoTitles)
      .subscribe(selectedDemoTitle => {
        const selectedSvgStrings = DEMO_MAP.get(selectedDemoTitle);
        if (!selectedSvgStrings) {
          return;
        }
        ga('send', 'event', 'Demos', 'Demo selected', selectedDemoTitle);
        this.stateService.reset();
        DemoUtil.loadDemo(this.stateService, selectedSvgStrings);
      });
  }

  onSendFeedbackClick() {
    ga('send', 'event', 'Miscellaneous', 'Send feedback click');
  }

  onAboutClick() {
    ga('send', 'event', 'Miscellaneous', 'About click');
  }

  // TODO: need to also support keyboard deletions
  // TODO: support multi select/multi delete
  // TODO: implement pair subpaths mode
  // TODO: shift ops in action mode?
  // TODO: implement hover hints (similar to inspector)
  // TODO: need to improve how points are selected/enlarged in the canvas...

  onCloseActionModeClick() {
    this.hoverService.resetAndNotify();
    this.selectionService.resetAndNotify();
    this.appModeService.setAppMode(AppMode.Selection);
  }

  onAddPointsClick() {
    // TODO: prefer already selected subpaths over others when creating new points?
    const appMode = this.appModeService.getAppMode();
    this.appModeService.setAppMode(
      appMode === AppMode.SplitCommands ? AppMode.Selection : AppMode.SplitCommands);
  }

  onSplitSubPathsClick() {
    // TODO: prefer already selected subpaths over others when splitting new subpaths?
    const appMode = this.appModeService.getAppMode();
    this.appModeService.setAppMode(
      appMode === AppMode.SplitSubPaths ? AppMode.Selection : AppMode.SplitSubPaths);
  }

  onMorphSubPathsClick() {
    const appMode = this.appModeService.getAppMode();
    this.appModeService.setAppMode(
      appMode === AppMode.MorphSubPaths ? AppMode.Selection : AppMode.MorphSubPaths);
  }

  onReversePointsHover(isHovering: boolean) {
    const { source, subIdx } = this.selectionService.getSubPathSelections()[0];
    if (isHovering) {
      this.hoverService.setHoverAndNotify({ source, subIdx, type: HoverType.Reverse });
    } else {
      this.hoverService.resetAndNotify();
    }
  }

  onReversePointsClick() {
    const selections = this.selectionService.getSubPathSelections();
    const { source } = selections[0];
    const pathMutator = this.stateService.getActivePathLayer(source).pathData.mutate();
    for (const { subIdx } of this.selectionService.getSubPathSelections()) {
      pathMutator.reverseSubPath(subIdx);
    }
    this.stateService.updateActivePath(source, pathMutator.build());
    this.hoverService.resetAndNotify();
  }

  onShiftBackPointsHover(isHovering: boolean) {
    const { source, subIdx } = this.selectionService.getSubPathSelections()[0];
    if (isHovering) {
      this.hoverService.setHoverAndNotify({ source, subIdx, type: HoverType.ShiftBack });
    } else {
      this.hoverService.resetAndNotify();
    }
  }

  onShiftBackPointsClick() {
    const selections = this.selectionService.getSubPathSelections();
    const { source } = selections[0];
    const pathMutator = this.stateService.getActivePathLayer(source).pathData.mutate();
    for (const { subIdx } of this.selectionService.getSubPathSelections()) {
      pathMutator.shiftSubPathBack(subIdx);
    }
    this.stateService.updateActivePath(source, pathMutator.build());
    this.hoverService.resetAndNotify();
  }

  onShiftForwardPointsHover(isHovering: boolean) {
    const { source, subIdx } = this.selectionService.getSubPathSelections()[0];
    if (isHovering) {
      this.hoverService.setHoverAndNotify({ source, subIdx, type: HoverType.Reverse });
    } else {
      this.hoverService.resetAndNotify();
    }
  }

  onShiftForwardPointsClick() {
    const selections = this.selectionService.getSubPathSelections();
    const { source } = selections[0];
    const pathMutator = this.stateService.getActivePathLayer(source).pathData.mutate();
    for (const { subIdx } of this.selectionService.getSubPathSelections()) {
      pathMutator.shiftSubPathBack(subIdx);
    }
    this.stateService.updateActivePath(source, pathMutator.build());
    this.hoverService.resetAndNotify();
  }

  onDeleteSubPathsClick() {
    deleteSelectedSplitSubPath(this.stateService, this.selectionService);
  }

  onDeleteSegmentsClick() {
    deleteSelectedSplitSegment(this.stateService, this.selectionService);
  }

  onSetFirstPositionHover(isHovering: boolean) {
    const { source, subIdx, cmdIdx } = this.selectionService.getPointSelections()[0];
    if (isHovering) {
      this.hoverService.setHoverAndNotify({
        source, subIdx, cmdIdx, type: HoverType.SetFirstPosition,
      });
    } else {
      this.hoverService.resetAndNotify();
    }
  }

  onSetFirstPositionClick() {
    const { source, subIdx, cmdIdx } = this.selectionService.getPointSelections()[0];
    const activePath = this.stateService.getActivePathLayer(source).pathData;
    this.stateService.updateActivePath(
      source,
      activePath.mutate()
        .shiftSubPathForward(subIdx, cmdIdx)
        .build());
    this.selectionService.resetAndNotify();
  }

  onSplitInHalfHoverEvent(isHovering: boolean) {
    const { source, subIdx, cmdIdx } = this.selectionService.getPointSelections()[0];
    if (isHovering) {
      this.hoverService.setHoverAndNotify({
        source, subIdx, cmdIdx, type: HoverType.Split,
      });
    } else {
      this.hoverService.resetAndNotify();
    }
  }

  onSplitInHalfClick() {
    const { source, subIdx, cmdIdx } = this.selectionService.getPointSelections()[0];
    const activePath = this.stateService.getActivePathLayer(source).pathData;
    this.stateService.updateActivePath(
      source,
      activePath.mutate()
        .splitCommandInHalf(subIdx, cmdIdx)
        .build());
    this.selectionService.resetAndNotify();
  }

  onDeletePointsClick() {
    deleteSelectedSplitPoints(this.stateService, this.selectionService);
  }
}

class ToolbarData {
  private readonly subPaths: ReadonlyArray<number> = [];
  private readonly segments: ReadonlyArray<{ subIdx: number, cmdIdx: number }> = [];
  private readonly points: ReadonlyArray<{ subIdx: number, cmdIdx: number }> = [];
  private readonly numSplitSubPaths: number;
  private readonly numSplitPoints: number;
  private readonly showSetFirstPosition: boolean;
  private readonly showShiftSubPath: boolean;
  private readonly isFilled: boolean;
  private readonly isStroked: boolean;
  private readonly showSplitInHalf: boolean;
  private readonly unpairedSubPathSource: CanvasType;

  constructor(
    stateService: StateService,
    morphSubPathService: MorphSubPathService,
    private readonly appMode: AppMode,
    selections: ReadonlyArray<Selection>,
  ) {
    // Precondition: assume all selections are for the same canvas type
    if (!selections.length) {
      return;
    }
    const canvasType = selections[0].source;
    const activePathLayer = stateService.getActivePathLayer(canvasType);
    if (!activePathLayer) {
      return;
    }
    const activePath = activePathLayer.pathData;
    this.isFilled = activePathLayer.isFilled();
    this.isStroked = activePathLayer.isStroked();
    this.subPaths =
      selections
        .filter(s => s.type === SelectionType.SubPath)
        .map(s => s.subIdx);
    this.segments =
      _.chain(selections)
        .filter(s => {
          const { subIdx, cmdIdx } = s;
          return s.type === SelectionType.Segment
            && activePathLayer.isFilled()
            && activePath.getCommand(subIdx, cmdIdx).isSplitSegment();
        })
        .flatMap(s => {
          // TODO: also include connected segments as well.
          const { subIdx, cmdIdx } = s;
          return [{ subIdx, cmdIdx }];
        })
        .value();
    this.points =
      selections.filter(s => s.type === SelectionType.Point)
        .map(s => {
          const { subIdx, cmdIdx } = s;
          return { subIdx, cmdIdx };
        });

    this.numSplitSubPaths = _.sumBy(this.subPaths, subIdx => {
      return activePath.getSubPath(subIdx).isUnsplittable() ? 1 : 0;
    });
    this.numSplitPoints = _.sumBy(this.points, s => {
      const { subIdx, cmdIdx } = s;
      return activePath.getCommand(subIdx, cmdIdx).isSplitPoint() ? 1 : 0;
    });
    this.showSetFirstPosition = this.points.length === 1
      && this.points[0].cmdIdx
      && activePath.getSubPath(this.points[0].subIdx).isClosed();
    this.showShiftSubPath = this.subPaths.length > 0
      && activePath.getSubPath(this.subPaths[0]).isClosed();
    this.showSplitInHalf = this.points.length === 1 && !!this.points[0].cmdIdx;
    if (this.appMode === AppMode.MorphSubPaths) {
      const unpair = morphSubPathService.getUnpairedSubPath();
      if (unpair) {
        this.unpairedSubPathSource = unpair.source;
      }
    }
  }

  getNumSelections() {
    return this.subPaths.length + this.segments.length + this.points.length;
  }

  getNumSubPaths() {
    return this.subPaths.length;
  }

  getNumSegments() {
    return this.segments.length;
  }

  getNumPoints() {
    return this.points.length;
  }

  getToolbarTitle() {
    if (this.appMode === AppMode.SplitCommands) {
      return 'Add points';
    }
    if (this.appMode === AppMode.SplitSubPaths) {
      return 'Split subpaths';
    }
    if (this.appMode === AppMode.MorphSubPaths) {
      return 'Pair subpaths';
    }
    const numSubPaths = this.getNumSubPaths();
    const subStr = `${numSubPaths} subpath${numSubPaths === 1 ? '' : 's'}`;
    const numSegments = this.getNumSegments();
    const segStr = `${numSegments} segment${numSegments === 1 ? '' : 's'}`;
    const numPoints = this.getNumPoints();
    const ptStr = `${numPoints} point${numPoints === 1 ? '' : 's'}`;
    if (numSubPaths > 0) {
      return `${subStr} selected`;
    } else if (numSegments > 0) {
      return `${segStr} selected`;
    } else if (numPoints > 0) {
      return `${ptStr} selected`;
    } else if (this.shouldShowActionMode()) {
      return '';
    }
    return 'Shape Shifter';
  }

  getToolbarSubtitle() {
    if (this.appMode === AppMode.SplitCommands) {
      return 'Click along the edge of a subpath to add a point';
    } else if (this.appMode === AppMode.SplitSubPaths) {
      if (this.isFilled) {
        return 'Draw a line across a subpath to split it into 2';
      } else if (this.isStroked) {
        return 'Click along the edge of a subpath to split it into 2';
      }
    } else if (this.appMode === AppMode.MorphSubPaths) {
      if (this.unpairedSubPathSource) {
        const toSourceDir = this.unpairedSubPathSource === CanvasType.Start ? 'right' : 'left';
        return `Pair the selected subpath with a corresponding subpath on the ${toSourceDir}`;
      }
      return 'Select a subpath';
    }
    return '';
  }

  getNumSplitSubPaths() {
    return this.numSplitSubPaths || 0;
  }

  getNumSplitPoints() {
    return this.numSplitPoints || 0;
  }

  shouldShowSetFirstPosition() {
    return this.showSetFirstPosition || false;
  }

  shouldShowShiftSubPath() {
    return this.showShiftSubPath || false;
  }

  shouldShowActionMode() {
    return this.getNumSelections() > 0 || !this.isSelectionMode();
  }

  shouldShowSplitInHalf() {
    return this.showSplitInHalf || false;
  }

  isSelectionMode() {
    return this.appMode === AppMode.Selection;
  }

  isAddPointsMode() {
    return this.appMode === AppMode.SplitCommands;
  }

  isSplitSubPathsMode() {
    return this.appMode === AppMode.SplitSubPaths;
  }

  isMorphSubPathsMode() {
    return this.appMode === AppMode.MorphSubPaths;
  }
}
