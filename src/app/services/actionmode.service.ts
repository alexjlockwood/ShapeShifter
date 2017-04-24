import { Injectable } from '@angular/core';
import { HoverService, HoverType } from './hover.service';
import { StateService, MorphStatus } from './state.service';
import {
  SelectionService,
  deleteSelectedSplitSubPath,
  deleteSelectedSplitSegment,
  deleteSelectedSplitPoints,
} from './selection.service';
import { AppModeService, AppMode } from './appmode.service';

/**
 * A simple service that provides an interface for making action mode changes.
 */
@Injectable()
export class ActionModeService {

  constructor(
    private readonly hoverService: HoverService,
    private readonly stateService: StateService,
    private readonly appModeService: AppModeService,
    private readonly selectionService: SelectionService,
  ) { }

  isShowingActionMode() {
    return this.stateService.getMorphStatus() !== MorphStatus.None
      && (this.selectionService.getSelections().length
        || this.appModeService.getAppMode() !== AppMode.Selection);
  }

  isShowingSubPathActionMode() {
    return this.stateService.getMorphStatus() !== MorphStatus.None
      && (this.selectionService.getSubPathSelections().length
        || this.appModeService.getAppMode() !== AppMode.Selection);
  }

  isShowingSegmentActionMode() {
    return this.stateService.getMorphStatus() !== MorphStatus.None
      && (this.selectionService.getSegmentSelections().length
        || this.appModeService.getAppMode() !== AppMode.Selection);
  }

  isShowingPointActionMode() {
    return this.stateService.getMorphStatus() !== MorphStatus.None
      && (this.selectionService.getPointSelections().length
        || this.appModeService.getAppMode() !== AppMode.Selection);
  }

  closeActionMode() {
    this.hoverService.resetAndNotify();
    this.selectionService.resetAndNotify();
    this.appModeService.setAppMode(AppMode.Selection);
  }

  toggleSplitCommandsMode() {
    // TODO: prefer already selected subpaths over others when creating new points?
    const appMode = this.appModeService.getAppMode();
    this.appModeService.setAppMode(
      appMode === AppMode.SplitCommands ? AppMode.Selection : AppMode.SplitCommands);
  }

  toggleSplitSubPathsMode() {
    // TODO: prefer already selected subpaths over others when splitting new subpaths?
    const appMode = this.appModeService.getAppMode();
    this.appModeService.setAppMode(
      appMode === AppMode.SplitSubPaths ? AppMode.Selection : AppMode.SplitSubPaths);
  }

  toggleMorphSubPathsMode() {
    const appMode = this.appModeService.getAppMode();
    this.appModeService.setAppMode(
      appMode === AppMode.MorphSubPaths ? AppMode.Selection : AppMode.MorphSubPaths);
  }

  reversePoints() {
    const selections = this.selectionService.getSubPathSelections();
    const { source } = selections[0];
    const pathMutator = this.stateService.getActivePathLayer(source).pathData.mutate();
    for (const { subIdx } of this.selectionService.getSubPathSelections()) {
      pathMutator.reverseSubPath(subIdx);
    }
    this.stateService.updateActivePath(source, pathMutator.build());
    this.hoverService.resetAndNotify();
  }

  shiftBackPoints() {
    const selections = this.selectionService.getSubPathSelections();
    const { source } = selections[0];
    const pathMutator = this.stateService.getActivePathLayer(source).pathData.mutate();
    for (const { subIdx } of this.selectionService.getSubPathSelections()) {
      pathMutator.shiftSubPathBack(subIdx);
    }
    this.stateService.updateActivePath(source, pathMutator.build());
    this.hoverService.resetAndNotify();
  }

  shiftForwardPoints() {
    const selections = this.selectionService.getSubPathSelections();
    const { source } = selections[0];
    const pathMutator = this.stateService.getActivePathLayer(source).pathData.mutate();
    for (const { subIdx } of this.selectionService.getSubPathSelections()) {
      pathMutator.shiftSubPathBack(subIdx);
    }
    this.stateService.updateActivePath(source, pathMutator.build());
    this.hoverService.resetAndNotify();
  }

  deleteSubPaths() {
    deleteSelectedSplitSubPath(this.stateService, this.selectionService);
  }

  deleteSegments() {
    deleteSelectedSplitSegment(this.stateService, this.selectionService);
  }

  setFirstPosition() {
    const { source, subIdx, cmdIdx } = this.selectionService.getPointSelections()[0];
    const activePath = this.stateService.getActivePathLayer(source).pathData;
    this.stateService.updateActivePath(
      source,
      activePath.mutate()
        .shiftSubPathForward(subIdx, cmdIdx)
        .build());
  }

  splitInHalfHover(isHovering: boolean) {
    const { source, subIdx, cmdIdx } = this.selectionService.getPointSelections()[0];
    if (isHovering) {
      this.hoverService.setHoverAndNotify({
        source, subIdx, cmdIdx, type: HoverType.Split,
      });
    } else {
      this.hoverService.resetAndNotify();
    }
  }

  splitInHalfClick() {
    const { source, subIdx, cmdIdx } = this.selectionService.getPointSelections()[0];
    const activePath = this.stateService.getActivePathLayer(source).pathData;
    this.stateService.updateActivePath(
      source,
      activePath.mutate()
        .splitCommandInHalf(subIdx, cmdIdx)
        .build());
    this.selectionService.resetAndNotify();
  }

  deletePoints() {
    deleteSelectedSplitPoints(this.stateService, this.selectionService);
  }
}
