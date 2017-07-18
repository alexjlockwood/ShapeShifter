import 'rxjs/add/operator/first';

import { Injectable } from '@angular/core';
import {
  ActionMode,
  ActionSource,
  Hover,
  HoverType,
  Selection,
  SelectionType,
} from 'app/model/actionmode';
import { MorphableLayer } from 'app/model/layers';
import { Path, PathMutator, PathUtil } from 'app/model/paths';
import { PathAnimationBlock } from 'app/model/timeline';
import { AutoAwesome } from 'app/scripts/algorithms';
import { State, Store } from 'app/store';
import {
  SetActionMode,
  SetActionModeHover,
  SetActionModeSelections,
} from 'app/store/actionmode/actions';
import {
  PairSubPath,
  SetUnpairedSubPath,
  UpdateActivePathBlock,
} from 'app/store/actionmode/metaactions';
import {
  getActionMode,
  getActionModeHover,
  getActionModeSelections,
} from 'app/store/actionmode/selectors';
import { MultiAction } from 'app/store/multiaction/actions';
import * as _ from 'lodash';
import { OutputSelector } from 'reselect';

import { LayerTimelineService } from './layertimeline.service';

/**
 * A simple service that provides an interface for making action mode changes.
 */
@Injectable()
export class ActionModeService {
  constructor(
    private readonly store: Store<State>,
    private readonly layerTimelineService: LayerTimelineService,
  ) {}

  // Action mode.

  isActionMode() {
    return this.getActionMode() !== ActionMode.None;
  }

  getActionMode() {
    return this.queryStore(getActionMode);
  }

  setActionMode(mode: ActionMode) {
    this.store.dispatch(new SetActionMode(mode));
  }

  toggleSplitCommandsMode() {
    this.toggleActionMode(ActionMode.SplitCommands);
  }

  toggleSplitSubPathsMode() {
    this.toggleActionMode(ActionMode.SplitSubPaths);
  }

  togglePairSubPathsMode() {
    this.toggleActionMode(ActionMode.PairSubPaths);
  }

  private toggleActionMode(modeToToggle: ActionMode) {
    const currentMode = this.getActionMode();
    if (currentMode === ActionMode.None) {
      return;
    }
    this.setActionMode(currentMode === modeToToggle ? ActionMode.Selection : modeToToggle);
  }

  isShowingSubPathActionMode() {
    return this.isShowingActionModeType(SelectionType.SubPath);
  }

  isShowingSegmentActionMode() {
    return this.isShowingActionModeType(SelectionType.Segment);
  }

  isShowingPointActionMode() {
    return this.isShowingActionModeType(SelectionType.Point);
  }

  private isShowingActionModeType(type: SelectionType) {
    const mode = this.getActionMode();
    return (
      mode !== ActionMode.None &&
      (mode !== ActionMode.Selection || this.getSelections().filter(s => s.type === type).length)
    );
  }

  closeActionMode() {
    const mode = this.getActionMode();
    if (mode === ActionMode.None) {
      return;
    }
    if (mode === ActionMode.Selection) {
      if (this.queryStore(getActionModeSelections).length) {
        // TODO: move this logic out into a component (it's confusing)
        this.store.dispatch(new SetActionModeSelections([]));
      } else {
        this.store.dispatch(new SetActionMode(ActionMode.None));
      }
    } else {
      this.store.dispatch(new SetActionMode(ActionMode.Selection));
    }
  }

  // Selections.

  setSelections(selections: ReadonlyArray<Selection>) {
    this.store.dispatch(new SetActionModeSelections(selections));
  }

  getSelections() {
    return this.queryStore(getActionModeSelections);
  }

  toggleSubPathSelection(source: ActionSource, subIdx: number) {
    const selections = [...this.getSelections()];
    _.remove(selections, s => s.type !== SelectionType.SubPath || s.source !== source);
    const type = SelectionType.SubPath;
    const toggledSelections = this.toggleSelections(selections, [{ type, source, subIdx }]);
    this.store.dispatch(new SetActionModeSelections(toggledSelections));
  }

  toggleSegmentSelections(
    source: ActionSource,
    segments: ReadonlyArray<{ subIdx: number; cmdIdx: number }>,
  ) {
    const selections = [...this.getSelections()];
    _.remove(selections, s => s.type !== SelectionType.Segment || s.source !== source);
    const type = SelectionType.Segment;
    const toggledSelections = this.toggleSelections(
      selections,
      segments.map(({ subIdx, cmdIdx }) => ({ type, source, subIdx, cmdIdx })),
    );
    this.store.dispatch(new SetActionModeSelections(toggledSelections));
  }

  togglePointSelection(
    source: ActionSource,
    subIdx: number,
    cmdIdx: number,
    isShiftOrMetaPressed: boolean,
  ) {
    const selections = [...this.getSelections()];
    _.remove(selections, s => s.type !== SelectionType.Point || s.source !== source);
    const type = SelectionType.Point;
    const toggledSelections = this.toggleSelections(
      selections,
      [{ type, source, subIdx, cmdIdx }],
      isShiftOrMetaPressed,
    );
    this.store.dispatch(new SetActionModeSelections(toggledSelections));
  }

  /**
   * Toggles the specified shape shifter selections. If a selection exists, all selections
   * will be removed from the list. Otherwise, they will be added to the list of selections.
   * By default, all other selections from the list will be cleared.
   */
  private toggleSelections(
    currentSelections: Selection[],
    newSelections: Selection[],
    appendToList = false,
  ) {
    const matchingSelections = _.remove(currentSelections, currSel => {
      // Remove any selections that are equal to a new selection.
      return newSelections.some(s => _.isEqual(s, currSel));
    });
    if (!matchingSelections.length) {
      // If no selections were removed, then add all of the selections to the list.
      currentSelections.push(...newSelections);
    }
    if (!appendToList) {
      // If we aren't appending multiple selections at a time, then clear
      // any previous selections from the list.
      _.remove(currentSelections, currSel => {
        return newSelections.every(newSel => !_.isEqual(currSel, newSel));
      });
    }
    return currentSelections;
  }

  // Hovers.

  setHover(newHover: Hover) {
    const currHover = this.queryStore(getActionModeHover);
    if (!_.isEqual(newHover, currHover)) {
      this.store.dispatch(new SetActionModeHover(newHover));
    }
  }

  splitInHalfHover() {
    const pointSelections = this.getSelections().filter(s => s.type === SelectionType.Point);
    if (pointSelections.length) {
      const { source, subIdx, cmdIdx } = pointSelections[0];
      this.setHover({ type: HoverType.Split, source, subIdx, cmdIdx });
    }
  }

  clearHover() {
    this.setHover(undefined);
  }

  // Mutate subpaths.

  reverseSelectedSubPaths() {
    this.mutateSelectedSubPaths((pm, subIdx) => pm.reverseSubPath(subIdx));
  }

  shiftBackSelectedSubPaths() {
    this.mutateSelectedSubPaths((pm, subIdx) => pm.shiftSubPathBack(subIdx));
  }

  shiftForwardSelectedSubPaths() {
    this.mutateSelectedSubPaths((pm, subIdx) => pm.shiftSubPathForward(subIdx));
  }

  private mutateSelectedSubPaths(mutatorFn: (pm: PathMutator, subIdx: number) => void) {
    const selections = this.getSelections().filter(s => s.type === SelectionType.SubPath);
    const { source } = selections[0];
    const pm = this.getActivePathBlockValue(source).mutate();
    for (const { subIdx } of selections) {
      mutatorFn(pm, subIdx);
    }
    this.store.dispatch(
      new MultiAction(
        new UpdateActivePathBlock(source, pm.build()),
        new SetActionModeHover(undefined),
      ),
    );
  }

  // Mutate points.

  shiftPointToFront() {
    const selections = this.getSelections().filter(s => s.type === SelectionType.Point);
    const { source, subIdx, cmdIdx } = selections[0];
    const activePath = this.getActivePathBlockValue(source);
    const pm = activePath.mutate();
    pm.shiftSubPathForward(subIdx, cmdIdx);
    this.store.dispatch(new UpdateActivePathBlock(source, pm.build()));
  }

  splitSelectedPointInHalf() {
    const selections = this.getSelections().filter(s => s.type === SelectionType.Point);
    const { source, subIdx, cmdIdx } = selections[0];
    const activePath = this.getActivePathBlockValue(source);
    const pm = activePath.mutate();
    pm.splitCommandInHalf(subIdx, cmdIdx);
    this.store.dispatch(
      new MultiAction(
        new UpdateActivePathBlock(source, pm.build()),
        new SetActionModeSelections([]),
        new SetActionModeHover(undefined),
      ),
    );
  }

  // Pair/unpair subpaths.

  pairSubPath(subIdx: number, source: ActionSource) {
    this.store.dispatch(new PairSubPath(subIdx, source));
  }

  setUnpairedSubPath(unpair: { subIdx: number; source: ActionSource }) {
    this.store.dispatch(new SetUnpairedSubPath(unpair));
  }

  // Autofix.

  autoFix() {
    const { from, to } = AutoAwesome.autoFix(
      this.getActivePathBlockValue(ActionSource.From),
      this.getActivePathBlockValue(ActionSource.To),
    );
    this.store.dispatch(
      new MultiAction(
        new UpdateActivePathBlock(ActionSource.From, from),
        new UpdateActivePathBlock(ActionSource.To, to),
      ),
    );
  }

  // Delete selected action mode models.

  deleteSelectedActionModeModels() {
    if (this.getActionMode() !== ActionMode.Selection) {
      return;
    }
    const selections = this.getSelections();
    if (!selections.length) {
      return;
    }
    const subPathSelections = selections.filter(s => s.type === SelectionType.SubPath);
    const segmentSelections = selections.filter(s => s.type === SelectionType.Segment);
    const pointSelections = selections.filter(s => s.type === SelectionType.Point);
    let updatePathAction: UpdateActivePathBlock;
    if (subPathSelections.length) {
      // Precondition: all selections exist in the same canvas.
      const { source, subIdx } = subPathSelections[0];
      const pm = this.getActivePathBlockValue(source).mutate();
      const layer = this.getActivePathLayer();
      if (layer.isFilled()) {
        pm.deleteFilledSubPath(subIdx);
      } else if (layer.isStroked()) {
        pm.deleteStrokedSubPath(subIdx);
      }
      updatePathAction = new UpdateActivePathBlock(source, pm.build());
    } else if (segmentSelections.length) {
      // Precondition: all selections exist in the same canvas.
      const { source, subIdx, cmdIdx } = segmentSelections[0];
      updatePathAction = new UpdateActivePathBlock(
        source,
        this.getActivePathBlockValue(source)
          .mutate()
          .deleteFilledSubPathSegment(subIdx, cmdIdx)
          .build(),
      );
    } else if (pointSelections.length) {
      const source = pointSelections[0].source;
      const path = this.getActivePathBlockValue(source);
      const unsplitOpsMap = new Map<number, Array<{ subIdx: number; cmdIdx: number }>>();
      for (const { subIdx, cmdIdx } of pointSelections) {
        if (!path.getCommand(subIdx, cmdIdx).isSplitPoint()) {
          continue;
        }
        let subIdxOps = unsplitOpsMap.get(subIdx);
        if (!subIdxOps) {
          subIdxOps = [];
        }
        subIdxOps.push({ subIdx, cmdIdx });
        unsplitOpsMap.set(subIdx, subIdxOps);
      }
      const pm = path.mutate();
      unsplitOpsMap.forEach((ops, idx) => {
        PathUtil.sortPathOps(ops);
        for (const op of ops) {
          pm.unsplitCommand(op.subIdx, op.cmdIdx);
        }
      });
      updatePathAction = new UpdateActivePathBlock(source, pm.build());
    }
    if (updatePathAction) {
      this.store.dispatch(
        new MultiAction(
          updatePathAction,
          new SetActionModeSelections([]),
          new SetActionModeHover(undefined),
        ),
      );
    }
  }

  // Update active path block.

  updateActivePathBlock(source: ActionSource, path: Path) {
    this.store.dispatch(new UpdateActivePathBlock(source, path));
  }

  private getActivePathLayer() {
    const block = this.layerTimelineService.getSelectedBlocks()[0] as PathAnimationBlock;
    const vl = this.layerTimelineService.getVectorLayer();
    return vl.findLayerById(block.layerId) as MorphableLayer;
  }

  private getActivePathBlockValue(source: ActionSource) {
    const activeBlock = this.layerTimelineService.getSelectedBlocks()[0] as PathAnimationBlock;
    return source === ActionSource.From ? activeBlock.fromValue : activeBlock.toValue;
  }

  private queryStore<T>(selector: OutputSelector<Object, T, (res: Object) => T>) {
    let obj: T;
    this.store.select(selector).first().subscribe(o => (obj = o));
    return obj;
  }
}
