import { PathUtil } from '../scripts/paths';
import {
  AppMode,
  ExitShapeShifterMode,
  HoverType,
  SetAppMode,
  SetHover,
  State,
  Store,
} from '../store';
import { getAppMode } from '../store/shapeshifter/selectors';
import { Injectable } from '@angular/core';

/**
 * A simple service that provides an interface for making action mode changes.
 */
@Injectable()
export class ActionModeService {
  private appMode: AppMode;

  constructor(private readonly store: Store<State>) {
    this.store.select(getAppMode).subscribe(appMode => this.appMode = appMode);
  }

  closeActionMode() {
    this.store.dispatch(new ExitShapeShifterMode());
  }

  toggleSplitCommandsMode() {
    // TODO: prefer already selected subpaths over others when creating new points?
    this.store.dispatch(new SetAppMode(
      this.appMode === AppMode.SplitCommands ? AppMode.Selection : AppMode.SplitCommands));
  }

  toggleSplitSubPathsMode() {
    // TODO: prefer already selected subpaths over others when splitting new subpaths?
    this.store.dispatch(new SetAppMode(
      this.appMode === AppMode.SplitSubPaths ? AppMode.Selection : AppMode.SplitSubPaths));
  }

  toggleMorphSubPathsMode() {
    this.store.dispatch(new SetAppMode(
      this.appMode === AppMode.MorphSubPaths ? AppMode.Selection : AppMode.MorphSubPaths));
  }

  reversePoints() {
    // const selections = this.selectionService.getSubPathSelections();
    // const { source } = selections[0];
    // const pathMutator = this.stateService.getActivePathLayer(source).pathData.mutate();
    // for (const { subIdx } of this.selectionService.getSubPathSelections()) {
    //   pathMutator.reverseSubPath(subIdx);
    // }
    // this.stateService.updateActivePath(source, pathMutator.build());
    // this.hoverService.resetAndNotify();
  }

  shiftBackPoints() {
    // const selections = this.selectionService.getSubPathSelections();
    // const { source } = selections[0];
    // const pathMutator = this.stateService.getActivePathLayer(source).pathData.mutate();
    // for (const { subIdx } of this.selectionService.getSubPathSelections()) {
    //   pathMutator.shiftSubPathBack(subIdx);
    // }
    // this.stateService.updateActivePath(source, pathMutator.build());
    // this.hoverService.resetAndNotify();
  }

  shiftForwardPoints() {
    // const selections = this.selectionService.getSubPathSelections();
    // const { source } = selections[0];
    // const pathMutator = this.stateService.getActivePathLayer(source).pathData.mutate();
    // for (const { subIdx } of this.selectionService.getSubPathSelections()) {
    //   pathMutator.shiftSubPathForward(subIdx);
    // }
    // this.stateService.updateActivePath(source, pathMutator.build());
    // this.hoverService.resetAndNotify();
  }

  deleteSubPaths() {
    // // TODO: support deleting multiple subpaths at a time?
    // const selections = this.selectionService.getSubPathSelections();
    // if (!selections.length) {
    //   return;
    // }
    // // Preconditions: all selections exist in the same canvas.
    // const { source, subIdx } = selections[0];
    // const activePathLayer = this.stateService.getActivePathLayer(source);
    // this.selectionService.resetAndNotify();
    // this.hoverService.resetAndNotify();
    // const mutator = activePathLayer.pathData.mutate();
    // if (activePathLayer.isStroked()) {
    //   mutator.deleteStrokedSubPath(subIdx);
    // } else if (activePathLayer.isFilled()) {
    //   mutator.deleteFilledSubPath(subIdx);
    // }
    // this.stateService.updateActivePath(source, mutator.build());
  }

  deleteSegments() {
    // // TODO: support deleting multiple segments at a time?
    // const selections = this.selectionService.getSelections();
    // if (!selections.length) {
    //   return;
    // }
    // // Preconditions: all selections exist in the same canvas.
    // const { source, subIdx, cmdIdx } = selections[0];
    // const activePathLayer = this.stateService.getActivePathLayer(source);
    // this.selectionService.resetAndNotify();
    // this.hoverService.resetAndNotify();
    // const mutator = activePathLayer.pathData.mutate();
    // mutator.deleteFilledSubPathSegment(subIdx, cmdIdx);
    // this.stateService.updateActivePath(source, mutator.build());
  }

  setFirstPosition() {
    // const { source, subIdx, cmdIdx } = this.selectionService.getPointSelections()[0];
    // const activePath = this.stateService.getActivePathLayer(source).pathData;
    // this.stateService.updateActivePath(
    //   source,
    //   activePath.mutate()
    //     .shiftSubPathForward(subIdx, cmdIdx)
    //     .build());
  }

  splitInHalfHover(isHovering: boolean) {
    // const { source, subIdx, cmdIdx } = this.selectionService.getPointSelections()[0];
    // if (isHovering) {
    //   this.hoverService.setHoverAndNotify({
    //     source, subIdx, cmdIdx, type: HoverType.Split,
    //   });
    // } else {
    //   this.hoverService.resetAndNotify();
    // }
  }

  splitInHalfClick() {
    // const { source, subIdx, cmdIdx } = this.selectionService.getPointSelections()[0];
    // const activePath = this.stateService.getActivePathLayer(source).pathData;
    // this.stateService.updateActivePath(
    //   source,
    //   activePath.mutate()
    //     .splitCommandInHalf(subIdx, cmdIdx)
    //     .build());
    // this.selectionService.resetAndNotify();
  }

  deletePoints() {
  //   const selections = this.selectionService.getPointSelections();
  //   if (!selections.length) {
  //     return;
  //   }
  //   // Preconditions: all selections exist in the same canvas.
  //   const canvasType = selections[0].source;
  //   const activePathLayer = this.stateService.getActivePathLayer(canvasType);
  //   const unsplitOpsMap: Map<number, Array<{ subIdx: number, cmdIdx: number }>> = new Map();
  //   for (const selection of selections) {
  //     const { subIdx, cmdIdx } = selection;
  //     if (!activePathLayer.pathData.getCommand(subIdx, cmdIdx).isSplitPoint()) {
  //       continue;
  //     }
  //     let subIdxOps = unsplitOpsMap.get(subIdx);
  //     if (!subIdxOps) {
  //       subIdxOps = [];
  //     }
  //     subIdxOps.push({ subIdx, cmdIdx });
  //     unsplitOpsMap.set(subIdx, subIdxOps);
  //   }
  //   this.selectionService.resetAndNotify();
  //   this.hoverService.resetAndNotify();
  //   const mutator = activePathLayer.pathData.mutate();
  //   unsplitOpsMap.forEach((ops, idx) => {
  //     PathUtil.sortPathOps(ops);
  //     for (const op of ops) {
  //       mutator.unsplitCommand(op.subIdx, op.cmdIdx);
  //     }
  //   });
  //   this.stateService.updateActivePath(canvasType, mutator.build());
  }
}
