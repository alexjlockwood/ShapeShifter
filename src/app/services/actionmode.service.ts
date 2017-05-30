import { PathUtil } from '../scripts/paths';
import {
  ClearActivePathBlockId,
  DeleteSelectedPoints,
  DeleteSelectedSegments,
  DeleteSelectedSubPaths,
  HoverType,
  ReverseSelectedSubPaths,
  SetPathHover,
  SetShapeShifterMode,
  ShapeShifterMode,
  ShiftBackSelectedSubPaths,
  ShiftForwardSelectedSubPaths,
  ShiftPointToFront,
  SplitCommandInHalfClick,
  SplitCommandInHalfHover,
  State,
  Store,
} from '../store';
import { getShapeShifterMode } from '../store/shapeshifter/selectors';
import { Injectable } from '@angular/core';

/**
 * A simple service that provides an interface for making action mode changes.
 */
@Injectable()
export class ActionModeService {
  private mode: ShapeShifterMode;

  constructor(private readonly store: Store<State>) {
    this.store.select(getShapeShifterMode).subscribe(mode => this.mode = mode);
  }

  closeActionMode() {
    this.store.dispatch(new ClearActivePathBlockId());
  }

  toggleSplitCommandsMode() {
    // TODO: prefer already selected subpaths over others when creating new points?
    this.store.dispatch(
      new SetShapeShifterMode(
        this.mode === ShapeShifterMode.SplitCommands
          ? ShapeShifterMode.Selection
          : ShapeShifterMode.SplitCommands));
  }

  toggleSplitSubPathsMode() {
    // TODO: prefer already selected subpaths over others when splitting new subpaths?
    this.store.dispatch(
      new SetShapeShifterMode(
        this.mode === ShapeShifterMode.SplitSubPaths
          ? ShapeShifterMode.Selection
          : ShapeShifterMode.SplitSubPaths));
  }

  toggleMorphSubPathsMode() {
    this.store.dispatch(
      new SetShapeShifterMode(
        this.mode === ShapeShifterMode.MorphSubPaths
          ? ShapeShifterMode.Selection
          : ShapeShifterMode.MorphSubPaths));
  }

  reversePoints() {
    this.store.dispatch(new ReverseSelectedSubPaths());
  }

  shiftBackPoints() {
    this.store.dispatch(new ShiftBackSelectedSubPaths());
  }

  shiftForwardPoints() {
    this.store.dispatch(new ShiftForwardSelectedSubPaths());
  }

  deleteSubPaths() {
    this.store.dispatch(new DeleteSelectedSubPaths())
  }

  deleteSegments() {
    this.store.dispatch(new DeleteSelectedSegments())
  }

  deletePoints() {
    this.store.dispatch(new DeleteSelectedPoints())
  }

  setFirstPosition() {
    this.store.dispatch(new ShiftPointToFront());
  }

  splitInHalfHover(isHovering: boolean) {
    this.store.dispatch(new SplitCommandInHalfHover())
  }

  splitInHalfClick() {
    this.store.dispatch(new SplitCommandInHalfClick())
  }
}
