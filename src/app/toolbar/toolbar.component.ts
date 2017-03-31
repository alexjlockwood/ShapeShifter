import { Component, OnInit, ViewContainerRef, ChangeDetectionStrategy } from '@angular/core';
import {
  StateService,
  MorphabilityStatus,
  AnimatorService,
  SelectionService,
} from '../services';
import { CanvasType } from '../CanvasType';
import { ExportUtil } from '../scripts/export';
import { DialogService } from '../dialogs';
import { AutoAwesome } from '../scripts/autoawesome';
import { DemoUtil, DEMO_MAP } from '../scripts/demos';
import { PathUtil } from '../scripts/paths';
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
  MORPHABILITY_NONE = MorphabilityStatus.None;
  MORPHABILITY_UNMORPHABLE = MorphabilityStatus.Unmorphable;
  MORPHABILITY_MORPHABLE = MorphabilityStatus.Morphable;
  morphabilityStatusObservable: Observable<MorphabilityStatus>;
  isActionModeEnabledObservable: Observable<boolean>;
  // This boolean is used to ensure the toolbar transition doesn't run on page load.
  hasActionModeBeenEnabled = false;
  getToolbarTextObservable: Observable<string>;
  isDirtyObservable: Observable<boolean>;

  constructor(
    private readonly viewContainerRef: ViewContainerRef,
    private readonly animatorService: AnimatorService,
    private readonly selectionService: SelectionService,
    private readonly stateService: StateService,
    private readonly dialogService: DialogService,
  ) { }

  ngOnInit() {
    this.morphabilityStatusObservable =
      this.stateService.getMorphabilityStatusObservable();
    this.isDirtyObservable = Observable.combineLatest(
      this.stateService.getVectorLayerObservable(CanvasType.Start),
      this.stateService.getVectorLayerObservable(CanvasType.End),
      (vl1, vl2) => !!vl1 || !!vl2);
    this.isActionModeEnabledObservable =
      this.selectionService.observe()
        .map(selections => {
          const shouldEnable =
            PathUtil.getNumSelectedPoints(
              this.stateService,
              selections,
              cmd => cmd.isSplit()) > 0;
          if (shouldEnable) {
            this.hasActionModeBeenEnabled = true;
          }
          return shouldEnable;
        });
    this.getToolbarTextObservable =
      this.selectionService.observe()
        .map(selections => {
          const numPointsSelected =
            PathUtil.getNumSelectedPoints(
              this.stateService,
              selections,
              cmd => cmd.isSplit());
          if (numPointsSelected > 0) {
            return `${numPointsSelected} deletable point${numPointsSelected === 1 ? '' : 's'} selected`;
          } else {
            return 'Shape Shifter';
          }
        });
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
    ExportUtil.exportCurrentState(this.stateService, this.animatorService);
  }

  onDeleteSelectedPointsClick() {
    PathUtil.deleteSelectedSplitPoints(this.stateService, this.selectionService);
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

