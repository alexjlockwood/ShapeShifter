import { DialogService } from '../dialogs';
import { PathLayer } from '../scripts/layers';
import { ActionModeService } from '../services';
import {
  ActionMode,
  ActionSource,
  Selection,
  SelectionType,
  State,
  Store,
} from '../store';
import { getToolbarState } from '../store/actionmode/selectors';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  ViewContainerRef,
} from '@angular/core';
import * as _ from 'lodash';
import { Observable } from 'rxjs/Observable';

// TODO: add back google analytics stuff!
// TODO: add back google analytics stuff!
// TODO: add back google analytics stuff!
// TODO: add back google analytics stuff!
// TODO: add back google analytics stuff!
declare const ga: Function;

@Component({
  selector: 'app-toolbar',
  templateUrl: './toolbar.component.html',
  styleUrls: ['./toolbar.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ToolbarComponent implements OnInit {

  // This boolean is used to ensure the toolbar transition doesn't run on page load.
  hasActionModeBeenEnabled = false;

  toolbarData$: Observable<ToolbarData>;
  shouldShowActionMode$: Observable<boolean>;

  constructor(
    readonly viewContainerRef: ViewContainerRef,
    readonly dialogService: DialogService,
    private readonly actionModeService: ActionModeService,
    private readonly store: Store<State>,
  ) { }

  ngOnInit() {
    this.toolbarData$ = this.store.select(getToolbarState)
      .map(({ isActionMode, fromPl, toPl, mode, selections, unpairedSubPath }) => {
        const selectionInfo =
          new ToolbarData(isActionMode, fromPl, toPl, mode, selections, unpairedSubPath);
        if (isActionMode) {
          this.hasActionModeBeenEnabled = true;
        }
        return selectionInfo;
      });
    this.shouldShowActionMode$ = this.toolbarData$.map(data => data.shouldShowActionMode());
  }

  // onNewClick() {
  //   ga('send', 'event', 'General', 'New click');

  //   this.dialogService
  //     .confirm(this.viewContainerRef, 'Start over?', 'You\'ll lose any unsaved changes.')
  //     .subscribe(result => {
  //       if (!result) {
  //         return;
  //       }
  //       this.stateService.reset();
  //     });
  // }

  onAutoFixClick() {
    ga('send', 'event', 'General', 'Auto fix click');

    this.actionModeService.autoFixClick();
  }

  // onExportClick() {
  //   ga('send', 'event', 'Export', 'Export click');
  //   const duration = this.settingsService.getDuration();
  //   const interpolator = this.settingsService.getInterpolator();
  //   ExportUtil.generateZip(this.stateService, duration, interpolator);
  // }

  // onDemoClick() {
  //   ga('send', 'event', 'Demos', 'Demos dialog shown');
  //   const demoTitles = Array.from(DEMO_MAP.keys());
  //   this.dialogService
  //     .demo(this.viewContainerRef, demoTitles)
  //     .subscribe(selectedDemoTitle => {
  //       const selectedSvgStrings = DEMO_MAP.get(selectedDemoTitle);
  //       if (!selectedSvgStrings) {
  //         return;
  //       }
  //       ga('send', 'event', 'Demos', 'Demo selected', selectedDemoTitle);
  //       this.stateService.reset();
  //       DemoUtil.loadDemo(this.stateService, selectedSvgStrings);
  //     });
  // }

  onSendFeedbackClick() {
    ga('send', 'event', 'Miscellaneous', 'Send feedback click');
  }

  onAboutClick() {
    ga('send', 'event', 'Miscellaneous', 'About click');
  }

  onCloseActionModeClick() {
    this.actionModeService.closeActionMode();
  }

  onAddPointsClick() {
    this.actionModeService.toggleSplitCommandsMode();
  }

  onSplitSubPathsClick() {
    this.actionModeService.toggleSplitSubPathsMode();
  }

  onMorphSubPathsClick() {
    this.actionModeService.toggleMorphSubPathsMode();
  }

  onReversePointsClick() {
    this.actionModeService.reversePoints();
  }

  onShiftBackPointsClick() {
    this.actionModeService.shiftBackPoints();
  }

  onShiftForwardPointsClick() {
    this.actionModeService.shiftForwardPoints();
  }

  onDeleteSubPathsClick() {
    this.actionModeService.deleteSubPaths();
  }

  onDeleteSegmentsClick() {
    this.actionModeService.deleteSegments();
  }

  onSetFirstPositionClick() {
    this.actionModeService.setFirstPosition();
  }

  onSplitInHalfHoverEvent(isHovering: boolean) {
    this.actionModeService.splitInHalfHover(isHovering);
  }

  onSplitInHalfClick() {
    this.actionModeService.splitInHalfClick();
  }

  onDeletePointsClick() {
    this.actionModeService.deletePoints();
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
  private readonly unpairedSubPathSource: ActionSource;
  private readonly showMorphSubPaths: boolean;

  constructor(
    private readonly showActionMode: boolean,
    activeStartPathLayer: PathLayer,
    activeEndPathLayer: PathLayer,
    public readonly mode: ActionMode,
    public readonly selections: ReadonlyArray<Selection>,
    readonly unpair: { source: ActionSource; subIdx: number; },
  ) {
    // Precondition: assume all selections are for the same canvas type
    if (!selections.length) {
      return;
    }
    const canvasType = selections[0].source;
    const activePathLayer =
      canvasType === ActionSource.From ? activeStartPathLayer : activeEndPathLayer;
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
        .map(s => {
          const { subIdx, cmdIdx } = s;
          return { subIdx, cmdIdx };
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
    if (this.mode === ActionMode.MorphSubPaths) {
      if (unpair) {
        this.unpairedSubPathSource = unpair.source;
      }
    }
    if (activeStartPathLayer.pathData.getSubPaths().length === 1
      && activeEndPathLayer.pathData.getSubPaths().length === 1) {
      this.showMorphSubPaths = false;
    } else {
      this.showMorphSubPaths =
        this.getNumSubPaths() === 1
        || this.getNumSegments() > 0
        || !this.isSelectionMode();
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
    if (this.mode === ActionMode.SplitCommands) {
      return 'Add points';
    }
    if (this.mode === ActionMode.SplitSubPaths) {
      return 'Split subpaths';
    }
    if (this.mode === ActionMode.MorphSubPaths) {
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
    if (this.mode === ActionMode.SplitCommands) {
      return 'Click along the edge of a subpath to add a point';
    } else if (this.mode === ActionMode.SplitSubPaths) {
      if (this.isFilled) {
        return 'Draw a line across a subpath to split it into 2';
      } else if (this.isStroked) {
        return 'Click along the edge of a subpath to split it into 2';
      }
    } else if (this.mode === ActionMode.MorphSubPaths) {
      if (this.unpairedSubPathSource) {
        const toSourceDir = this.unpairedSubPathSource === ActionSource.From ? 'right' : 'left';
        return `Pair the selected subpath with a corresponding subpath on the ${toSourceDir}`;
      }
      return 'Select a subpath';
    }
    return '';
  }

  shouldShowActionMode() {
    return this.showActionMode;
  }

  shouldShowMorphSubPaths() {
    return this.showMorphSubPaths;
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
    return this.mode === ActionMode.Selection;
  }

  isAddPointsMode() {
    return this.mode === ActionMode.SplitCommands;
  }

  isSplitSubPathsMode() {
    return this.mode === ActionMode.SplitSubPaths;
  }

  isMorphSubPathsMode() {
    return this.mode === ActionMode.MorphSubPaths;
  }

  shouldShowAutoFix() {
    return this.shouldShowActionMode() && !this.getNumSelections();
  }
}
