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
import { Command } from '../scripts/paths';
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

  morphStatusObservable: Observable<MorphStatus>;
  isActionModeEnabledObservable: Observable<boolean>;
  // This boolean is used to ensure the toolbar transition doesn't run on page load.
  hasActionModeBeenEnabled = false;
  getToolbarTextObservable: Observable<string>;
  isDirtyObservable: Observable<boolean>;

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
    this.isActionModeEnabledObservable =
      this.selectionService.asObservable()
        .map(selections => {
          const shouldEnable =
            this.getNumSelectedPoints(
              this.stateService,
              selections,
              cmd => cmd.isSplit()) > 0;
          if (shouldEnable) {
            this.hasActionModeBeenEnabled = true;
          }
          return shouldEnable;
        });
    this.getToolbarTextObservable =
      this.selectionService.asObservable()
        .map(selections => {
          const numPointsSelected =
            this.getNumSelectedPoints(
              this.stateService,
              selections,
              cmd => cmd.isSplit());
          if (numPointsSelected > 0) {
            return `${numPointsSelected} split point${numPointsSelected === 1 ? '' : 's'} selected`;
          } else {
            return 'Shape Shifter';
          }
        });
  }

  private getNumSelectedPoints(
    lss: StateService,
    selections: ReadonlyArray<Selection>,
    predicateFn = (cmd: Command) => true) {

    selections = selections.filter(s => s.type === SelectionType.Point);

    if (!selections.length) {
      return 0;
    }

    // Preconditions: all selections exist in the same editor and
    // all selections correspond to the currently active path id.
    const canvasType = selections[0].source;
    const activePathLayer = lss.getActivePathLayer(canvasType);
    if (!activePathLayer) {
      return 0;
    }

    const activePath = activePathLayer.pathData;
    return _.sum(selections.map(s => {
      const { subIdx, cmdIdx } = s;
      const cmd = activePath.getSubPaths()[subIdx].getCommands()[cmdIdx];
      return predicateFn(cmd) ? 1 : 0;
    }));
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

