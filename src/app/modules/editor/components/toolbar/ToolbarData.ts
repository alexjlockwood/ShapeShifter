import {
  ActionMode,
  ActionSource,
  getSelectionsOfType,
  Selection,
  SelectionType,
} from 'app/modules/editor/model/actionmode';
import { MorphableLayer } from 'app/modules/editor/model/layers';
import { sumBy } from 'lodash-es';

/**
 * Determines what to show in the toolbar and the action bar for the current action mode and
 * selections. The status strip's message is getActionModeStatus's (actionModeStatus.ts).
 */
export class ToolbarData {
  private readonly subPaths: ReadonlyArray<number> = [];
  private readonly segments: ReadonlyArray<{ subIdx: number; cmdIdx: number }> = [];
  private readonly points: ReadonlyArray<{ subIdx: number; cmdIdx: number }> = [];
  private readonly numSplitSubPaths: number = 0;
  private readonly numSplitPoints: number = 0;
  private readonly showSetFirstPosition: boolean = false;
  private readonly showShiftSubPath: boolean = false;
  private readonly showSplitInHalf: boolean = false;
  private readonly showPairSubPaths: boolean = false;

  constructor(
    readonly mode: ActionMode,
    startMorphableLayer: MorphableLayer | undefined,
    endMorphableLayer: MorphableLayer | undefined,
    readonly selections: ReadonlyArray<Selection>,
  ) {
    // Precondition: assume all selections are for the same canvas type
    if (!selections.length) {
      return;
    }
    const canvasType = selections[0].source;
    const morphableLayer =
      canvasType === ActionSource.From ? startMorphableLayer : endMorphableLayer;
    const activePath = morphableLayer?.pathData;
    if (!morphableLayer || !activePath) {
      return;
    }
    this.subPaths = getSelectionsOfType(selections, SelectionType.SubPath).map(s => s.subIdx);
    this.segments = getSelectionsOfType(selections, SelectionType.Segment)
      .filter(
        ({ subIdx, cmdIdx }) =>
          morphableLayer.isFilled() && activePath.getCommand(subIdx, cmdIdx).isSplitSegment(),
      )
      .map(({ subIdx, cmdIdx }) => ({ subIdx, cmdIdx }));
    this.points = getSelectionsOfType(selections, SelectionType.Point).map(
      ({ subIdx, cmdIdx }) => ({ subIdx, cmdIdx }),
    );

    this.numSplitSubPaths = sumBy(this.subPaths, subIdx => {
      return activePath.getSubPath(subIdx).isUnsplittable() ? 1 : 0;
    });
    this.numSplitPoints = sumBy(this.points, s => {
      const { subIdx, cmdIdx } = s;
      return activePath.getCommand(subIdx, cmdIdx).isSplitPoint() ? 1 : 0;
    });
    this.showSetFirstPosition =
      this.points.length === 1 &&
      !!this.points[0].cmdIdx &&
      activePath.getSubPath(this.points[0].subIdx).isClosed();
    this.showShiftSubPath =
      this.subPaths.length > 0 && activePath.getSubPath(this.subPaths[0]).isClosed();
    this.showSplitInHalf = this.points.length === 1 && !!this.points[0].cmdIdx;
    this.showPairSubPaths =
      startMorphableLayer?.pathData?.getSubPaths().length === 1 &&
      endMorphableLayer?.pathData?.getSubPaths().length === 1
        ? false
        : this.getNumSubPaths() === 1 || this.getNumSegments() > 0 || !this.isSelectionMode();
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
    if (this.mode === ActionMode.SplitCommands) {
      return 'Add points';
    }
    if (this.mode === ActionMode.SplitSubPaths) {
      return 'Split subpaths';
    }
    if (this.mode === ActionMode.PairSubPaths) {
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
    } else if (this.mode === ActionMode.Selection) {
      return 'Edit path morphing animation';
    }
    return 'Shape Shifter';
  }

  shouldShowActionMode() {
    return this.mode !== ActionMode.None;
  }

  shouldShowPairSubPaths() {
    return this.showPairSubPaths;
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

  shouldShowSplitInHalf() {
    return this.showSplitInHalf || false;
  }

  isSelectionMode() {
    return this.mode === ActionMode.None || this.mode === ActionMode.Selection;
  }

  isAddPointsMode() {
    return this.mode === ActionMode.SplitCommands;
  }

  isSplitSubPathsMode() {
    return this.mode === ActionMode.SplitSubPaths;
  }

  isPairSubPathsMode() {
    return this.mode === ActionMode.PairSubPaths;
  }

  shouldShowAutoFix() {
    return this.mode === ActionMode.Selection && !this.getNumSelections();
  }
}
