import { LayerStateService, AnimatorService } from '../../services';
import { PathLayer, GroupLayer, VectorLayer } from '../layers';
import { CanvasType } from '../../CanvasType';
import { AvdSerializer, SvgSerializer } from '.';
import { AvdTarget, AvdAnimation, PropertyName, ValueType } from '../animation';
import * as JSZip from 'jszip';
import * as $ from 'jquery';

export function exportCurrentState(lss: LayerStateService, as: AnimatorService) {
  const startVectorLayer = lss.getVectorLayer(CanvasType.Start).clone();
  const endVectorLayer = lss.getVectorLayer(CanvasType.End).clone();
  const startVectorLayerChildren: Array<PathLayer | GroupLayer> = [];
  const endVectorLayerChildren: Array<PathLayer | GroupLayer> = [];
  const avdTargets: AvdTarget[] = [];
  const alphaTarget = createAlphaAvdTarget(lss, as);
  if (alphaTarget) {
    avdTargets.push(alphaTarget);
  }
  const rotationTarget = createRotationAvdTarget(lss, as);
  if (rotationTarget) {
    avdTargets.push(rotationTarget);
    startVectorLayerChildren.push(lss.getActiveRotationLayer(CanvasType.Start));
    endVectorLayerChildren.push(lss.getActiveRotationLayer(CanvasType.End));
  } else {
    startVectorLayerChildren.push(lss.getActivePathLayer(CanvasType.Start));
    endVectorLayerChildren.push(lss.getActivePathLayer(CanvasType.End));
  }
  avdTargets.push(createPathAvdTarget(lss, as));
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

function createAlphaAvdTarget(lss: LayerStateService, as: AnimatorService) {
  const startLayer = lss.getVectorLayer(CanvasType.Start);
  const endLayer = lss.getVectorLayer(CanvasType.End);
  if (startLayer.alpha === endLayer.alpha) {
    return undefined;
  }
  const fromValue = startLayer.alpha;
  const toValue = endLayer.alpha;
  const duration = as.getDuration();
  const interpolator = as.getInterpolator();
  return new AvdTarget(startLayer.id,
    [new AvdAnimation(
      fromValue.toString(),
      toValue.toString(),
      duration,
      interpolator.androidRef,
      'alpha',
      'floatType')]);
}

function createRotationAvdTarget(lss: LayerStateService, as: AnimatorService) {
  const startLayer = lss.getActiveRotationLayer(CanvasType.Start);
  const endLayer = lss.getActiveRotationLayer(CanvasType.End);
  if (!startLayer || !endLayer || startLayer.rotation === endLayer.rotation) {
    return undefined;
  }
  const fromValue = startLayer.rotation;
  const toValue = endLayer.rotation;
  const duration = as.getDuration();
  const interpolator = as.getInterpolator();
  return new AvdTarget(startLayer.id,
    [new AvdAnimation(
      fromValue.toString(),
      toValue.toString(),
      duration,
      interpolator.androidRef,
      'rotation',
      'floatType')]);
}

function createPathAvdTarget(lss: LayerStateService, as: AnimatorService) {
  const startLayer = lss.getActivePathLayer(CanvasType.Start);
  const endLayer = lss.getActivePathLayer(CanvasType.End);
  const duration = as.getDuration();
  const interpolator = as.getInterpolator();
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

function downloadFile(content: Blob, fileName: string) {
  const url = window.URL.createObjectURL(content);
  const anchor = $('<a>').hide().appendTo(document.body);
  anchor.attr({ href: url, download: fileName });
  anchor.get(0).click();
  window.URL.revokeObjectURL(url);
}
