import { Injectable } from '@angular/core';
import { HoverService, HoverType } from './hover.service';
import { StateService, MorphStatus } from './state.service';
import { SelectionService } from './selection.service';
import { AppModeService, AppMode } from './appmode.service';
import { PathUtil } from '../scripts/paths';

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
    // TODO: support deleting multiple subpaths at a time?
    const selections = this.selectionService.getSubPathSelections();
    if (!selections.length) {
      return;
    }
    // Preconditions: all selections exist in the same canvas.
    const { source, subIdx } = selections[0];
    const activePathLayer = this.stateService.getActivePathLayer(source);
    this.selectionService.resetAndNotify();
    const mutator = activePathLayer.pathData.mutate();
    if (activePathLayer.isStroked()) {
      mutator.deleteStrokedSubPath(subIdx);
    } else if (activePathLayer.isFilled()) {
      mutator.deleteFilledSubPath(subIdx);
    }
    this.stateService.updateActivePath(source, mutator.build());
  }

  deleteSegments() {
    // TODO: support deleting multiple segments at a time?
    const selections = this.selectionService.getSelections();
    if (!selections.length) {
      return;
    }
    // Preconditions: all selections exist in the same canvas.
    const { source, subIdx, cmdIdx } = selections[0];
    const activePathLayer = this.stateService.getActivePathLayer(source);
    this.selectionService.resetAndNotify();
    const mutator = activePathLayer.pathData.mutate();
    mutator.deleteSubPathSplitSegment(subIdx, cmdIdx);
    this.stateService.updateActivePath(source, mutator.build());
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
    const selections = this.selectionService.getPointSelections();
    if (!selections.length) {
      return;
    }
    // Preconditions: all selections exist in the same canvas.
    const canvasType = selections[0].source;
    const activePathLayer = this.stateService.getActivePathLayer(canvasType);
    const unsplitOpsMap: Map<number, Array<{ subIdx: number, cmdIdx: number }>> = new Map();
    for (const selection of selections) {
      const { subIdx, cmdIdx } = selection;
      if (!activePathLayer.pathData.getCommand(subIdx, cmdIdx).isSplitPoint()) {
        continue;
      }
      let subIdxOps = unsplitOpsMap.get(subIdx);
      if (!subIdxOps) {
        subIdxOps = [];
      }
      subIdxOps.push({ subIdx, cmdIdx });
      unsplitOpsMap.set(subIdx, subIdxOps);
    }
    this.selectionService.resetAndNotify();
    const mutator = activePathLayer.pathData.mutate();
    unsplitOpsMap.forEach((ops, idx) => {
      PathUtil.sortPathOps(ops);
      for (const op of ops) {
        mutator.unsplitCommand(op.subIdx, op.cmdIdx);
      }
    });
    this.stateService.updateActivePath(canvasType, mutator.build());
  }
}
