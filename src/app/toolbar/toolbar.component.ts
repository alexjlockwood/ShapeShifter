import * as _ from 'lodash';
import { Component, OnInit, ViewContainerRef, ChangeDetectionStrategy } from '@angular/core';
import {
  StateService,
  MorphStatus,
  SettingsService,
  SelectionService,
  Selection,
  SelectionType,
} from '../services';
import { deleteSelectedSplitPoints } from '../services/selection.service';
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
  toolbarTextObservable: Observable<string>;
  selectionInfoObservable: Observable<SelectionInfo>;

  constructor(
    private readonly viewContainerRef: ViewContainerRef,
    private readonly settingsService: SettingsService,
    private readonly selectionService: SelectionService,
    private readonly stateService: StateService,
    private readonly dialogService: DialogService,
  ) { }

  ngOnInit() {
    this.morphStatusObservable = this.stateService.getMorphStatusObservable();
    this.isDirtyObservable =
      this.stateService.getExistingPathIdsObservable().map(ids => !!ids.length);
    this.selectionInfoObservable =
      this.selectionService.asObservable()
        .map(selections => {
          const selectionInfo = new SelectionInfo(this.stateService, selections);
          if (selectionInfo.getNumSelections() > 0) {
            this.hasActionModeBeenEnabled = true;
          }
          return selectionInfo;
        });
  }

  onCloseActionModeClick() {
    this.selectionService.reset();
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
      const numStartCmds = resultStartCmd.getSubPaths()[subIdx].getCommands().length;
      const numEndCmds = resultEndCmd.getSubPaths()[subIdx].getCommands().length;
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

  onPairWithSubPathsClick() {
    console.log('onPairWithSubPathsClick()');
  }

  onReversePointsClick() {
    console.log('onReversePointsClick()');
  }

  onDeleteSubPathsClick() {
    console.log('onDeleteSubPathsClick()');
  }

  onDeleteSegmentsClick() {
    console.log('onDeleteSegmentsClick()');
  }

  onShiftPointToFirstPositionClick() {
    console.log('onShiftPointToFirstPositionClick()');
  }

  onDeletePointsClick() {
    console.log('onDeletePointsClick');
    deleteSelectedSplitPoints(this.stateService, this.selectionService);
  }
}

class SelectionInfo {
  private readonly subPaths: ReadonlyArray<number> = [];
  private readonly segments: ReadonlyArray<{ subIdx: number, cmdIdx: number }> = [];
  private readonly points: ReadonlyArray<{ subIdx: number, cmdIdx: number }> = [];

  constructor(stateService: StateService, selections: ReadonlyArray<Selection>) {
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
    this.subPaths =
      selections
        .filter(s => s.type === SelectionType.SubPath)
        .map(s => s.subIdx);
    this.segments =
      _.chain(selections as Selection[])
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
  }

  getNumSelections() {
    return this.subPaths.length + this.segments.length + this.points.length;
  }

  getNumSubPaths() {
    return this.subPaths.length;
  }

  getNumSegments() {
    // Divide by 2 to account for paired split segments.
    return this.segments.length / 2;
  }

  getNumPoints() {
    return this.points.length;
  }

  getToolbarTitle() {
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
    } else {
      return 'Shape Shifter';
    }
  }
}
