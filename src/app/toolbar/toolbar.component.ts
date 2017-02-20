import * as _ from 'lodash';
import * as $ from 'jquery';
import { Component, OnInit, ViewContainerRef } from '@angular/core';
import { LayerStateService, MorphabilityStatus } from '../services';
import { CanvasType } from '../CanvasType';
import { AvdSerializer } from '../scripts/parsers';
import { AvdTarget, AvdAnimation } from '../scripts/animation';
import { DialogService } from '../dialogs';
import { AutoAwesome } from '../scripts/commands';
import { AnimatorService } from '../services/animator.service';
import { SelectionStateService } from '../services/selectionstate.service';
import { HoverStateService } from '../services/hoverstate.service';
import { DEMO_MAP } from '../demos';
import { VectorLayerLoader } from '../scripts/parsers';
import { VectorLayer, GroupLayer, PathLayer } from '../scripts/layers';
import { Observable } from 'rxjs/Observable';
import 'rxjs/add/observable/combineLatest';

@Component({
  selector: 'app-toolbar',
  templateUrl: './toolbar.component.html',
  styleUrls: ['./toolbar.component.scss']
})
export class ToolbarComponent implements OnInit {
  MORPHABILITY_NONE = MorphabilityStatus.None;
  MORPHABILITY_UNMORPHABLE = MorphabilityStatus.Unmorphable;
  MORPHABILITY_MORPHABLE = MorphabilityStatus.Morphable;
  morphabilityStatusObservable: Observable<MorphabilityStatus>;
  isDirtyObservable: Observable<boolean>;

  constructor(
    private viewContainerRef: ViewContainerRef,
    private animatorService: AnimatorService,
    private hoverStateService: HoverStateService,
    private selectionStateService: SelectionStateService,
    private layerStateService: LayerStateService,
    private dialogsService: DialogService) { }

  ngOnInit() {
    this.morphabilityStatusObservable =
      this.layerStateService.getMorphabilityStatusObservable();
    this.isDirtyObservable = Observable.combineLatest(
      this.layerStateService.getVectorLayerObservable(CanvasType.Start),
      this.layerStateService.getVectorLayerObservable(CanvasType.End),
      (vl1, vl2) => !!vl1 || !!vl2);
  }

  onNewClick() {
    this.dialogsService
      .confirm(this.viewContainerRef, 'Start over?', 'You\'ll lose any unsaved changes.')
      .subscribe(result => {
        if (!result) {
          return;
        }
        this.animatorService.reset();
        this.hoverStateService.reset();
        this.selectionStateService.reset();
        this.layerStateService.reset();
      });
  }

  onAutoFixClick() {
    let resultStartCmd = this.layerStateService.getActivePathLayer(CanvasType.Start).pathData;
    let resultEndCmd = this.layerStateService.getActivePathLayer(CanvasType.End).pathData;
    const numSubPaths =
      Math.min(resultStartCmd.subPathCommands.length, resultEndCmd.subPathCommands.length);
    for (let subIdx = 0; subIdx < numSubPaths; subIdx++) {
      // Pass the command with the larger subpath as the 'from' command.
      const numStartCmds = resultStartCmd.subPathCommands[subIdx].commands.length;
      const numEndCmds = resultEndCmd.subPathCommands[subIdx].commands.length;
      const fromCmd = numStartCmds >= numEndCmds ? resultStartCmd : resultEndCmd;
      const toCmd = numStartCmds >= numEndCmds ? resultEndCmd : resultStartCmd;
      const {from, to} = AutoAwesome.autoFix(subIdx, fromCmd, toCmd);
      resultStartCmd = numStartCmds >= numEndCmds ? from : to;
      resultEndCmd = numStartCmds >= numEndCmds ? to : from;
      // TODO: avoid calling these once-per-subIdx...
      this.layerStateService.replaceActivePathCommand(CanvasType.Start, resultStartCmd, subIdx, false);
      this.layerStateService.replaceActivePathCommand(CanvasType.End, resultEndCmd, subIdx, false);
    }
    this.layerStateService.notifyChange(CanvasType.Preview);
    this.layerStateService.notifyChange(CanvasType.Start);
    this.layerStateService.notifyChange(CanvasType.End);
  }

  onExportClick() {
    const startVectorLayer = this.layerStateService.getVectorLayer(CanvasType.Start).clone();
    const vectorLayerChildren: Array<PathLayer | GroupLayer> = [];
    const avdTargets: AvdTarget[] = [];
    const rotationTarget = this.createRotationAvdTarget();
    if (rotationTarget) {
      avdTargets.push(rotationTarget);
      vectorLayerChildren.push(this.layerStateService.getActiveRotationLayer(CanvasType.Start));
    } else {
      vectorLayerChildren.push(this.layerStateService.getActivePathLayer(CanvasType.Start));
    }
    avdTargets.push(this.createPathAvdTarget());
    const outputVectorLayer =
      new VectorLayer(
        vectorLayerChildren,
        startVectorLayer.id,
        startVectorLayer.width,
        startVectorLayer.height,
        startVectorLayer.alpha);
    const xmlStr = AvdSerializer.vectorLayerAnimationToAvdXmlString(outputVectorLayer, avdTargets);
    this.downloadFile(xmlStr, `ShapeShifterAvd.xml`);
  }

  private createRotationAvdTarget() {
    const startLayer = this.layerStateService.getActiveRotationLayer(CanvasType.Start);
    const endLayer = this.layerStateService.getActiveRotationLayer(CanvasType.End);
    if (!startLayer || !endLayer || startLayer.rotation === endLayer.rotation) {
      return undefined;
    }
    const fromValue = startLayer.rotation;
    const toValue = endLayer.rotation;
    const duration = this.animatorService.getDuration();
    const interpolator = this.animatorService.getInterpolator();
    return new AvdTarget(startLayer.id,
      new AvdAnimation(
        fromValue.toString(),
        toValue.toString(),
        duration,
        interpolator.androidRef,
        'rotation',
        'floatType'));
  }

  private createPathAvdTarget() {
    const startLayer = this.layerStateService.getActivePathLayer(CanvasType.Start);
    const endLayer = this.layerStateService.getActivePathLayer(CanvasType.End);
    const fromValue = startLayer.pathData.pathString;
    const toValue = endLayer.pathData.pathString;
    const duration = this.animatorService.getDuration();
    const interpolator = this.animatorService.getInterpolator();
    return new AvdTarget(startLayer.id,
      new AvdAnimation(
        fromValue,
        toValue,
        duration,
        interpolator.androidRef,
        'pathData',
        'pathType'));
  }

  onDemoClick() {
    const demoTitles = Array.from(DEMO_MAP.keys());
    this.dialogsService
      .demo(this.viewContainerRef, demoTitles)
      .subscribe(selectedDemoTitle => {
        const selectedSvgStrings = DEMO_MAP.get(selectedDemoTitle);
        if (!selectedSvgStrings) {
          return;
        }
        const importedStartVectorLayer = VectorLayerLoader.loadVectorLayerFromSvgString(selectedSvgStrings.start);
        const importedEndVectorLayer = VectorLayerLoader.loadVectorLayerFromSvgString(selectedSvgStrings.end);
        this.layerStateService.setVectorLayer(CanvasType.Start, importedStartVectorLayer.clone(), false);
        this.layerStateService.setVectorLayer(CanvasType.Preview, importedStartVectorLayer.clone(), false);
        this.layerStateService.setVectorLayer(CanvasType.End, importedEndVectorLayer.clone(), false);
        const availableStartPathIds: string[] = [];
        importedStartVectorLayer.walk((layer => {
          if (layer instanceof PathLayer) {
            availableStartPathIds.push(layer.id);
          }
        }));
        const availableEndPathIds: string[] = [];
        importedEndVectorLayer.walk((layer => {
          if (layer instanceof PathLayer) {
            availableEndPathIds.push(layer.id);
          }
        }));
        const shuffledStartPathIds = _.shuffle(availableStartPathIds);
        const shuffledEndPathIds = _.shuffle(availableEndPathIds);
        this.layerStateService.setActivePathId(CanvasType.Start, shuffledStartPathIds[0], false);
        this.layerStateService.setActivePathId(CanvasType.Preview, shuffledStartPathIds[0], false);
        this.layerStateService.setActivePathId(CanvasType.End, shuffledEndPathIds[0], false);
        this.layerStateService.notifyChange(CanvasType.Preview);
        this.layerStateService.notifyChange(CanvasType.Start);
        this.layerStateService.notifyChange(CanvasType.End);
      });
  }

  // TODO: display an in-app help dialog instead of redirecting to the GitHub README
  onHelpClick() {
    this.dialogsService.help(this.viewContainerRef);
  }

  private downloadFile(content: string, filename: string) {
    const blob = new Blob([content], { type: 'octet/stream' });
    const url = window.URL.createObjectURL(blob);
    const anchor = $('<a>').hide().appendTo(document.body);
    anchor.attr({ href: url, download: filename });
    anchor.get(0).click();
    window.URL.revokeObjectURL(url);
  }
}
