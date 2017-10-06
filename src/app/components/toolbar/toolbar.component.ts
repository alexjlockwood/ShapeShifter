import 'rxjs/add/operator/combineLatest';
import 'rxjs/add/operator/map';

import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { ActionMode, ActionSource, Selection, SelectionType } from 'app/model/actionmode';
import { MorphableLayer } from 'app/model/layers';
import { PathAnimationBlock } from 'app/model/timeline';
import { ActionModeUtil } from 'app/scripts/actionmode';
import { ActionModeService, ThemeService } from 'app/services';
import { State, Store } from 'app/store';
import { getToolbarState } from 'app/store/actionmode/selectors';
import { ThemeType } from 'app/store/theme/reducer';
import * as _ from 'lodash';
import { Observable } from 'rxjs/Observable';

declare const ga: Function;

@Component({
  selector: 'app-toolbar',
  templateUrl: './toolbar.component.html',
  styleUrls: ['./toolbar.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ToolbarComponent implements OnInit {
  toolbarData$: Observable<ToolbarData>;
  themeState$: Observable<{
    prevThemeType: ThemeType;
    currThemeType: ThemeType;
    prevIsActionMode: boolean;
    currIsActionMode: boolean;
  }>;

  constructor(
    private readonly actionModeService: ActionModeService,
    public readonly themeService: ThemeService,
    private readonly store: Store<State>,
  ) {}

  ngOnInit() {
    let hasActionModeBeenEnabled = false;
    let prevThemeType: ThemeType;
    let currThemeType = this.themeService.getThemeType().themeType;
    let prevIsActionMode: boolean;
    let currIsActionMode = this.actionModeService.getActionMode() !== ActionMode.None;
    const toolbarState = this.store.select(getToolbarState);
    this.toolbarData$ = toolbarState.map(
      ({ mode, fromMl, toMl, selections, unpairedSubPath, block }) => {
        return new ToolbarData(mode, fromMl, toMl, selections, unpairedSubPath, block);
      },
    );
    this.themeState$ = Observable.combineLatest(
      toolbarState,
      this.themeService.asObservable().map(t => t.themeType),
    ).map(([{ mode }, themeType]) => {
      hasActionModeBeenEnabled = hasActionModeBeenEnabled || mode !== ActionMode.None;
      prevThemeType = currThemeType;
      currThemeType = themeType;
      prevIsActionMode = currIsActionMode;
      currIsActionMode = mode !== ActionMode.None;
      return {
        hasActionModeBeenEnabled,
        prevThemeType,
        currThemeType,
        prevIsActionMode,
        currIsActionMode,
      };
    });
  }

  get darkTheme() {
    return this.themeService.getThemeType().themeType === 'dark';
  }

  set darkTheme(isDark: boolean) {
    this.themeService.setTheme(isDark ? 'dark' : 'light');
  }

  onSendFeedbackClick(event: MouseEvent) {
    ga('send', 'event', 'Miscellaneous', 'Send feedback click');
  }

  onContributeClick(event: MouseEvent) {
    ga('send', 'event', 'Miscellaneous', 'Contribute click');
  }

  onGettingStartedClick(event: MouseEvent) {
    ga('send', 'event', 'Miscellaneous', 'Getting started click');
  }

  onAutoFixClick(event: MouseEvent) {
    ga('send', 'event', 'Action mode', 'Auto fix click');
    event.stopPropagation();
    this.actionModeService.autoFix();
  }

  onCloseActionModeClick(event: MouseEvent) {
    event.stopPropagation();
    this.actionModeService.closeActionMode();
  }

  onAddPointsClick(event: MouseEvent) {
    ga('send', 'event', 'Action mode', 'Add points');
    event.stopPropagation();
    this.actionModeService.toggleSplitCommandsMode();
  }

  onSplitSubPathsClick(event: MouseEvent) {
    ga('send', 'event', 'Action mode', 'Split sub paths');
    event.stopPropagation();
    this.actionModeService.toggleSplitSubPathsMode();
  }

  onPairSubPathsClick(event: MouseEvent) {
    ga('send', 'event', 'Action mode', 'Pair sub paths');
    event.stopPropagation();
    this.actionModeService.togglePairSubPathsMode();
  }

  onReversePointsClick(event: MouseEvent) {
    event.stopPropagation();
    this.actionModeService.reverseSelectedSubPaths();
  }

  onShiftBackPointsClick(event: MouseEvent) {
    event.stopPropagation();
    this.actionModeService.shiftBackSelectedSubPaths();
  }

  onShiftForwardPointsClick(event: MouseEvent) {
    event.stopPropagation();
    this.actionModeService.shiftForwardSelectedSubPaths();
  }

  onDeleteSubPathsClick(event: MouseEvent) {
    event.stopPropagation();
    this.actionModeService.deleteSelectedActionModeModels();
  }

  onDeleteSegmentsClick(event: MouseEvent) {
    event.stopPropagation();
    this.actionModeService.deleteSelectedActionModeModels();
  }

  onSetFirstPositionClick(event: MouseEvent) {
    event.stopPropagation();
    this.actionModeService.shiftPointToFront();
  }

  onSplitInHalfHoverEvent(isHovering: boolean) {
    if (isHovering) {
      this.actionModeService.splitInHalfHover();
    } else {
      this.actionModeService.clearHover();
    }
  }

  onSplitInHalfClick(event: MouseEvent) {
    event.stopPropagation();
    this.actionModeService.splitSelectedPointInHalf();
  }

  onDeletePointsClick(event: MouseEvent) {
    event.stopPropagation();
    this.actionModeService.deleteSelectedActionModeModels();
  }
}

class ToolbarData {
  private readonly subPaths: ReadonlyArray<number> = [];
  private readonly segments: ReadonlyArray<{ subIdx: number; cmdIdx: number }> = [];
  private readonly points: ReadonlyArray<{ subIdx: number; cmdIdx: number }> = [];
  private readonly numSplitSubPaths: number;
  private readonly numSplitPoints: number;
  private readonly showSetFirstPosition: boolean;
  private readonly showShiftSubPath: boolean;
  private readonly isFilled: boolean;
  private readonly isStroked: boolean;
  private readonly showSplitInHalf: boolean;
  private readonly unpairedSubPathSource: ActionSource;
  private readonly showPairSubPaths: boolean;
  private readonly morphableLayerName: string;

  constructor(
    public readonly mode: ActionMode,
    startMorphableLayer: MorphableLayer,
    endMorphableLayer: MorphableLayer,
    public readonly selections: ReadonlyArray<Selection>,
    unpair: { source: ActionSource; subIdx: number },
    private readonly block: PathAnimationBlock | undefined,
  ) {
    // Precondition: assume all selections are for the same canvas type
    if (!selections.length) {
      return;
    }
    const canvasType = selections[0].source;
    const morphableLayer =
      canvasType === ActionSource.From ? startMorphableLayer : endMorphableLayer;
    if (!morphableLayer) {
      return;
    }
    this.morphableLayerName = morphableLayer.name;
    const activePath = morphableLayer.pathData;
    this.isFilled = morphableLayer.isFilled();
    this.isStroked = morphableLayer.isStroked();
    this.subPaths = selections.filter(s => s.type === SelectionType.SubPath).map(s => s.subIdx);
    this.segments = selections
      .filter(s => {
        const { subIdx, cmdIdx } = s;
        return (
          s.type === SelectionType.Segment &&
          morphableLayer.isFilled() &&
          activePath.getCommand(subIdx, cmdIdx).isSplitSegment()
        );
      })
      .map(s => {
        const { subIdx, cmdIdx } = s;
        return { subIdx, cmdIdx };
      });
    this.points = selections.filter(s => s.type === SelectionType.Point).map(s => {
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
    this.showSetFirstPosition =
      this.points.length === 1 &&
      this.points[0].cmdIdx &&
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
      startMorphableLayer.pathData.getSubPaths().length === 1 &&
      endMorphableLayer.pathData.getSubPaths().length === 1
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
