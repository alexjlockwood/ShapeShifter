import * as _ from 'lodash';
import * as $ from 'jquery';
import { Component, OnInit, ViewContainerRef, ChangeDetectionStrategy } from '@angular/core';
import { LayerStateService, MorphabilityStatus } from '../services';
import { CanvasType } from '../CanvasType';
import { AvdSerializer, SvgSerializer } from '../scripts/export';
import { AvdTarget, AvdAnimation, ValueType, PropertyName } from '../scripts/animation';
import { DialogService } from '../dialogs';
import { AutoAwesome } from '../scripts/autoawesome';
import { AnimatorService } from '../services/animator.service';
import { SelectionStateService } from '../services/selectionstate.service';
import { HoverStateService } from '../services/hoverstate.service';
import { DemoUtil, DEMO_MAP } from '../scripts/demos';
import { VectorLayer, GroupLayer, PathLayer } from '../scripts/layers';
import { Observable } from 'rxjs/Observable';
import 'rxjs/add/observable/combineLatest';
import * as JSZip from 'jszip';

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
    ga('send', 'event', 'General', 'New click');

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
    ga('send', 'event', 'General', 'Auto fix click');

    let resultStartCmd = this.layerStateService.getActivePathLayer(CanvasType.Start).pathData;
    let resultEndCmd = this.layerStateService.getActivePathLayer(CanvasType.End).pathData;
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
      // TODO: avoid calling these once-per-subIdx...
      this.layerStateService.updateActivePath(CanvasType.Start, resultStartCmd, subIdx, false);
      this.layerStateService.updateActivePath(CanvasType.End, resultEndCmd, subIdx, false);
    }
    this.layerStateService.notifyChange(CanvasType.Preview);
    this.layerStateService.notifyChange(CanvasType.Start);
    this.layerStateService.notifyChange(CanvasType.End);

  }

  onExportClick() {
    ga('send', 'event', 'Export', 'Export click');

    const startVectorLayer = this.layerStateService.getVectorLayer(CanvasType.Start).clone();
    const endVectorLayer = this.layerStateService.getVectorLayer(CanvasType.End).clone();
    const startVectorLayerChildren: Array<PathLayer | GroupLayer> = [];
    const endVectorLayerChildren: Array<PathLayer | GroupLayer> = [];
    const avdTargets: AvdTarget[] = [];
    const alphaTarget = this.createAlphaAvdTarget();
    if (alphaTarget) {
      avdTargets.push(alphaTarget);
    }
    const rotationTarget = this.createRotationAvdTarget();
    if (rotationTarget) {
      avdTargets.push(rotationTarget);
      startVectorLayerChildren.push(this.layerStateService.getActiveRotationLayer(CanvasType.Start));
      endVectorLayerChildren.push(this.layerStateService.getActiveRotationLayer(CanvasType.End));
    } else {
      startVectorLayerChildren.push(this.layerStateService.getActivePathLayer(CanvasType.Start));
      endVectorLayerChildren.push(this.layerStateService.getActivePathLayer(CanvasType.End));
    }
    avdTargets.push(this.createPathAvdTarget());
    const startOutputVectorLayer =
      new VectorLayer(
        startVectorLayerChildren,
        startVectorLayer.id,
        startVectorLayer.width,
        startVectorLayer.height,
        startVectorLayer.alpha);
    const endOutputVectorLayer =
      new VectorLayer(
        endVectorLayerChildren,
        endVectorLayer.id,
        endVectorLayer.width,
        endVectorLayer.height,
        endVectorLayer.alpha);
    const zip = new JSZip();
    zip.file('README.txt', createExportReadme());
    const android = zip.folder('android');
    const avd = AvdSerializer.vectorLayerAnimationToAvdXmlString(startOutputVectorLayer, avdTargets);
    android.file('AnimatedVectorDrawable.xml', avd);
    const startVD = AvdSerializer.vectorLayerToVectorDrawableXmlString(startOutputVectorLayer);
    android.file('StartVectorDrawable.xml', startVD);
    const endVD = AvdSerializer.vectorLayerToVectorDrawableXmlString(startOutputVectorLayer);
    android.file('EndVectorDrawable.xml', endVD);
    const web = zip.folder('web');
    const startSvg = SvgSerializer.vectorLayerToSvgString(startOutputVectorLayer);
    web.file('StartSvg.svg', startSvg);
    const endSvg = SvgSerializer.vectorLayerToSvgString(endOutputVectorLayer);
    web.file('EndSvg.svg', endSvg);
    zip.generateAsync({ type: 'blob' }).then(content => {
      downloadFile(content, `ShapeShifter.zip`);
    });
  }

  private createAlphaAvdTarget() {
    const startLayer = this.layerStateService.getVectorLayer(CanvasType.Start);
    const endLayer = this.layerStateService.getVectorLayer(CanvasType.End);
    if (startLayer.alpha === endLayer.alpha) {
      return undefined;
    }
    const fromValue = startLayer.alpha;
    const toValue = endLayer.alpha;
    const duration = this.animatorService.getDuration();
    const interpolator = this.animatorService.getInterpolator();
    return new AvdTarget(startLayer.id,
      [new AvdAnimation(
        fromValue.toString(),
        toValue.toString(),
        duration,
        interpolator.androidRef,
        'alpha',
        'floatType')]);
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
      [new AvdAnimation(
        fromValue.toString(),
        toValue.toString(),
        duration,
        interpolator.androidRef,
        'rotation',
        'floatType')]);
  }

  private createPathAvdTarget() {
    const startLayer = this.layerStateService.getActivePathLayer(CanvasType.Start);
    const endLayer = this.layerStateService.getActivePathLayer(CanvasType.End);
    const fromValue = startLayer.pathData.getPathString();
    const toValue = endLayer.pathData.getPathString();
    const duration = this.animatorService.getDuration();
    const interpolator = this.animatorService.getInterpolator();
    const createAvdAnimation = (from: string, to: string, propertyName: PropertyName, valueType: ValueType) => {
      return new AvdAnimation(from, to, duration, interpolator.androidRef, propertyName, valueType);
    };
    const avdAnimations: AvdAnimation[] = [];
    avdAnimations.push(
      createAvdAnimation(
        startLayer.pathData.getPathString(),
        endLayer.pathData.getPathString(),
        'pathData',
        'pathType'));
    if (startLayer.fillColor && endLayer.fillColor && startLayer.fillColor !== endLayer.fillColor) {
      avdAnimations.push(
        createAvdAnimation(startLayer.fillColor, endLayer.fillColor, 'fillColor', 'colorType'));
    }
    if (startLayer.strokeColor && endLayer.strokeColor && startLayer.strokeColor !== endLayer.strokeColor) {
      avdAnimations.push(
        createAvdAnimation(startLayer.strokeColor, endLayer.strokeColor, 'strokeColor', 'colorType'));
    }
    if (startLayer.fillAlpha !== endLayer.fillAlpha) {
      avdAnimations.push(
        createAvdAnimation(
          startLayer.fillAlpha.toString(), endLayer.fillAlpha.toString(), 'fillAlpha', 'floatType'));
    }
    if (startLayer.strokeAlpha !== endLayer.strokeAlpha) {
      avdAnimations.push(
        createAvdAnimation(
          startLayer.strokeAlpha.toString(), endLayer.strokeAlpha.toString(), 'strokeAlpha', 'floatType'));
    }
    if (startLayer.strokeWidth !== endLayer.strokeWidth) {
      avdAnimations.push(
        createAvdAnimation(
          startLayer.strokeWidth.toString(), endLayer.strokeWidth.toString(), 'strokeWidth', 'floatType'));
    }
    return new AvdTarget(startLayer.id, avdAnimations);
  }

  onDemoClick() {
    ga('send', 'event', 'Demos', 'Demos dialog shown');
    const demoTitles = Array.from(DEMO_MAP.keys());
    this.dialogsService
      .demo(this.viewContainerRef, demoTitles)
      .subscribe(selectedDemoTitle => {
        const selectedSvgStrings = DEMO_MAP.get(selectedDemoTitle);
        if (!selectedSvgStrings) {
          return;
        }
        ga('send', 'event', 'Demos', 'Demo selected', selectedDemoTitle);
        DemoUtil.loadDemo(this.layerStateService, selectedSvgStrings);
      });
  }

  onSendFeedbackClick() {
    ga('send', 'event', 'Miscellaneous', 'Send feedback click');
  }

  onAboutClick() {
    ga('send', 'event', 'Miscellaneous', 'About click');
  }
}

function downloadFile(content: Blob, fileName: string) {
  const url = window.URL.createObjectURL(content);
  const anchor = $('<a>').hide().appendTo(document.body);
  anchor.attr({ href: url, download: fileName });
  anchor.get(0).click();
  window.URL.revokeObjectURL(url);
}

function createExportReadme() {
  return `=== Files exported by Shape Shifter ===

This archive contains the following:

web/
  - StartSvg.svg
  - EndSvg.svg

android/
  - StartVectorDrawable.xml
  - EndVectorDrawable.xml
  - AnimatedVectorDrawable.xml

If you have an export format that you'd like to see added, please file
a feature request using the link below!

Further reading:

  - Shape Shifter live version:
    https://alexjlockwood.github.io/ShapeShifter

  - Shape Shifter source code:
    https://github.com/alexjlockwood/ShapeShifter

  - File a feature request:
    https://github.com/alexjlockwood/ShapeShifter/issues

  - Introduction to Icon Animations blog post:
    http://www.androiddesignpatterns.com/2016/11/introduction-to-icon-animation-techniques.html

  - Animated Vector Drawable sample Android application:
    https://github.com/alexjlockwood/adp-delightful-details

  - VectorDrawable & AnimatedVectorDrawable developer training docs:
    https://developer.android.com/guide/topics/graphics/vector-drawable-resources.html

(c) 2017 Alex Lockwood
`;
}
