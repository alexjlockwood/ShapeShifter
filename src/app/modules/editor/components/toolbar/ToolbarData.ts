import {
  ActionMode,
  ActionSource,
  getSelectionsOfType,
  Selection,
  SelectionType,
} from 'app/modules/editor/model/actionmode';
import { MorphableLayer } from 'app/modules/editor/model/layers';
import { PathAnimationBlock } from 'app/modules/editor/model/timeline';
import { ActionModeUtil } from 'app/modules/editor/scripts/actionmode';
import _ from 'lodash';

/**
 * Determines what to show in the toolbar for the current action mode and selections.
 */
export class ToolbarData {
  private readonly subPaths: ReadonlyArray<number> = [];
  private readonly segments: ReadonlyArray<{ subIdx: number; cmdIdx: number }> = [];
  private readonly points: ReadonlyArray<{ subIdx: number; cmdIdx: number }> = [];
  private readonly numSplitSubPaths: number = 0;
  private readonly numSplitPoints: number = 0;
  private readonly showSetFirstPosition: boolean = false;
  private readonly showShiftSubPath: boolean = false;
  private readonly isFilled: boolean = false;
  private readonly isStroked: boolean = false;
  private readonly showSplitInHalf: boolean = false;
  private readonly unpairedSubPathSource: ActionSource | undefined;
  private readonly showPairSubPaths: boolean = false;

  constructor(
    readonly mode: ActionMode,
    startMorphableLayer: MorphableLayer | undefined,
    endMorphableLayer: MorphableLayer | undefined,
    readonly selections: ReadonlyArray<Selection>,
    unpair: { source: ActionSource; subIdx: number } | undefined,
    private readonly block: PathAnimationBlock | undefined,
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
    this.isFilled = morphableLayer.isFilled();
    this.isStroked = morphableLayer.isStroked();
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

    this.numSplitSubPaths = _.sumBy(this.subPaths, subIdx => {
      return activePath.getSubPath(subIdx).isUnsplittable() ? 1 : 0;
    });
    this.numSplitPoints = _.sumBy(this.points, s => {
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
    if (this.mode === ActionMode.PairSubPaths) {
      if (unpair) {
        this.unpairedSubPathSource = unpair.source;
      }
    }
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

  getToolbarSubtitle() {
    if (this.mode === ActionMode.SplitCommands) {
      return 'Click along the edge of a subpath to add a point';
    } else if (this.mode === ActionMode.SplitSubPaths) {
      if (this.isFilled) {
        return 'Draw a line across a subpath to split it into 2';
      } else if (this.isStroked) {
        return 'Click along the edge of a subpath to split it into 2';
      }
    } else if (this.mode === ActionMode.PairSubPaths) {
      if (this.unpairedSubPathSource) {
        const toSourceDir = this.unpairedSubPathSource === ActionSource.From ? 'right' : 'left';
        return `Pair the selected subpath with a corresponding subpath on the ${toSourceDir}`;
      }
      return 'Select a subpath';
    } else if (this.mode === ActionMode.Selection) {
      if (!this.block) {
        // The block can be deselected before action mode is closed.
        return '';
      }
      const { areCompatible, errorPath, numPointsMissing } = ActionModeUtil.checkPathsCompatible(
        this.block,
      );
      if (!areCompatible) {
        const createSubtitleFn = (direction: string) => {
          if (numPointsMissing === 1) {
            return `Add 1 point to the highlighted subpath on the ${direction}`;
          } else {
            return `Add ${numPointsMissing} points to the highlighted subpath on the ${direction}`;
          }
        };
        if (errorPath === ActionSource.From) {
          return createSubtitleFn('left');
        } else if (errorPath === ActionSource.To) {
          return createSubtitleFn('right');
        }
        // This should never happen, but return empty string just to be safe.
        return '';
      }
      if (!this.getNumSubPaths() && !this.getNumSegments() && !this.getNumPoints()) {
        return 'Select something below to edit its properties';
      }
    }
    return '';
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
