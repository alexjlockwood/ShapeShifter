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

  readonly ACTION_MODE_SUBPATH = ActionMode.SubPath;
  readonly ACTION_MODE_SEGMENT = ActionMode.Segment;
  readonly ACTION_MODE_POINT = ActionMode.Point;

  // This boolean is used to ensure the toolbar transition doesn't run on page load.
  hasActionModeBeenEnabled = false;

  morphStatusObservable: Observable<MorphStatus>;
  isDirtyObservable: Observable<boolean>;
  toolbarTextObservable: Observable<string>;
  actionModeObservable: Observable<ActionMode>;

  constructor(
    private readonly viewContainerRef: ViewContainerRef,
    private readonly settingsService: SettingsService,
    private readonly selectionService: SelectionService,
    private readonly stateService: StateService,
    private readonly dialogService: DialogService,
  ) { }

  ngOnInit() {
    this.morphStatusObservable =
      this.stateService.getMorphStatusObservable();
    this.isDirtyObservable =
      this.stateService.getExistingPathIdsObservable().map(ids => !!ids.length);
    this.actionModeObservable =
      this.selectionService.asObservable()
        .map(selections => {
          let actionMode = ActionMode.Disabled;
          if (this.getNumSelectedSubPaths(selections) > 0) {
            actionMode = ActionMode.SubPath;
          } else if (this.getNumSelectedSegments(selections) > 0) {
            actionMode = ActionMode.Segment;
          } else if (this.getNumSelectedPoints(selections) > 0) {
            actionMode = ActionMode.Point;
          }
          if (actionMode !== ActionMode.Disabled) {
            this.hasActionModeBeenEnabled = true;
          }
          return actionMode;
        });
    this.toolbarTextObservable =
      this.selectionService.asObservable()
        .map(selections => {
          const numSubPaths = this.getNumSelectedSubPaths(selections);
          const subStr = `${numSubPaths} subpath${numSubPaths === 1 ? '' : 's'}`;
          const numSegments = this.getNumSelectedSegments(selections);
          const segStr = `${numSegments} split segment${numSegments === 1 ? '' : 's'}`;
          const numPoints = this.getNumSelectedPoints(selections);
          const ptStr = `${numPoints} split point${numPoints === 1 ? '' : 's'}`;
          if (numSubPaths > 0) {
            return `${subStr} selected`;
          } else if (numSegments > 0) {
            return `${segStr} selected`;
          } else if (numPoints > 0) {
            return `${ptStr} selected`;
          } else {
            return '';
          }
        });
  }

  private getNumSelectedSubPaths(selections: ReadonlyArray<Selection>) {
    selections = selections.filter(s => s.type === SelectionType.SubPath);
    if (!selections.length) {
      return 0;
    }
    // Preconditions: all selections exist in the same editor and
    // all selections correspond to the currently active path id.
    const canvasType = selections[0].source;
    const activePathLayer = this.stateService.getActivePathLayer(canvasType);
    if (!activePathLayer) {
      return 0;
    }
    return selections.length;
  }

  private getNumSelectedSegments(selections: ReadonlyArray<Selection>) {
    selections = selections.filter(s => s.type === SelectionType.Segment);
    if (!selections.length) {
      return 0;
    }
    // Preconditions: all selections exist in the same editor and
    // all selections correspond to the currently active path id.
    const canvasType = selections[0].source;
    const activePathLayer = this.stateService.getActivePathLayer(canvasType);
    if (!activePathLayer) {
      return 0;
    }
    const activePath = activePathLayer.pathData;
    return _.sumBy(selections, s => {
      return activePath.getCommand(s.subIdx, s.cmdIdx).isSplitSegment() ? 1 : 0;
    }) / 2;
  }

  private getNumSelectedPoints(selections: ReadonlyArray<Selection>) {
    selections = selections.filter(s => s.type === SelectionType.Point);
    if (!selections.length) {
      return 0;
    }
    // Preconditions: all selections exist in the same editor and
    // all selections correspond to the currently active path id.
    const canvasType = selections[0].source;
    const activePathLayer = this.stateService.getActivePathLayer(canvasType);
    if (!activePathLayer) {
      return 0;
    }
    const activePath = activePathLayer.pathData;
    return _.sumBy(selections, s => {
      return activePath.getCommand(s.subIdx, s.cmdIdx).isSplitPoint() ? 1 : 0;
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

  onDeleteSelectedPointsClick() {
    deleteSelectedSplitPoints(this.stateService, this.selectionService);
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
}

enum ActionMode {
  Disabled,
  SubPath,
  Segment,
  Point,
}
