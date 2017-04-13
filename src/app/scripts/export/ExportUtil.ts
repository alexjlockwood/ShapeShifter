import * as JSZip from 'jszip';
import * as $ from 'jquery';
import * as KeyframesSerializer from './KeyframesSerializer';
import * as JsSerializer from './JsSerializer';
import * as SpriteSerializer from './SpriteSerializer';
import { environment } from '../../../environments/environment';
import { StateService } from '../../services';
import { PathLayer, GroupLayer, VectorLayer } from '../layers';
import { CanvasType } from '../../CanvasType';
import { AvdSerializer, SvgSerializer } from '.';
import { ColorUtil } from '../common';
import {
  AvdTarget, AvdAnimation, AvdPropertyName, AvdValueType,
  SvgTarget, SvgAnimation, SvgPropertyName, Interpolator,
} from '../animation';

// TODO: release this when it is ready and tested
const SHOULD_EXPORT_CSS_KEYFRAMES = !environment.production && true;
const SHOULD_EXPORT_JS_SCRIPT = !environment.production && false;
const SHOULD_EXPORT_SVG_SPRITE = !environment.production && true;

export function generateZip(
  stateService: StateService,
  duration: number,
  interpolator: Interpolator) {

  const startVlChildren: Array<PathLayer | GroupLayer> = [];
  const endVlChildren: Array<PathLayer | GroupLayer> = [];

  // Create AvdTargets.
  const avdTargets: AvdTarget[] = [];
  const startVl = stateService.getVectorLayer(CanvasType.Start);
  const endVl = stateService.getVectorLayer(CanvasType.End);

  // Create vector layer target.
  const alphaTarget =
    createAlphaAvdTarget(
      startVl,
      endVl,
      duration,
      interpolator.androidRef);
  if (alphaTarget) {
    avdTargets.push(alphaTarget);
  }

  const startGl = stateService.getActiveRotationLayer(CanvasType.Start);
  const endGl = stateService.getActiveRotationLayer(CanvasType.End);

  // Create rotation layer target.
  const rotationTarget =
    createRotationAvdTarget(
      startGl,
      endGl,
      duration,
      interpolator.androidRef);
  const startPl = stateService.getActivePathLayer(CanvasType.Start);
  const endPl = stateService.getActivePathLayer(CanvasType.End);
  if (rotationTarget) {
    avdTargets.push(rotationTarget);
    startVlChildren.push(startGl);
    endVlChildren.push(endGl);
  } else {
    startVlChildren.push(startPl);
    endVlChildren.push(endPl);
  }

  // Create path layer target.
  avdTargets.push(
    createPathAvdTarget(
      startPl,
      endPl,
      duration,
      interpolator.androidRef));

  // Create VectorLayers.
  const startOutVl =
    new VectorLayer(
      startVlChildren,
      startVl.id,
      startVl.width,
      startVl.height,
      startVl.alpha);
  const endOutVl =
    new VectorLayer(
      endVlChildren,
      endVl.id,
      endVl.width,
      endVl.height,
      endVl.alpha);

  // Create SvgTargets.
  const svgTargets: SvgTarget[] = [];

  // Create vector layer target.
  const opacitySvgTarget =
    createOpacitySvgTarget(
      startVl,
      endVl,
      duration,
      'ease-in-out');
  if (opacitySvgTarget) {
    svgTargets.push(opacitySvgTarget);
  }

  // Create rotation layer target.
  const rotationSvgTarget =
    createRotationSvgTarget(
      startGl,
      endGl,
      duration,
      'ease-in-out');
  if (rotationSvgTarget) {
    svgTargets.push(rotationSvgTarget);
  }

  // Create path layer target.
  svgTargets.push(
    createPathSvgTarget(
      startPl,
      endPl,
      duration,
      'ease-in-out'));

  // Create compatible SVGs (note that we intentionally don't run SVGO on these).
  const startSvg = SvgSerializer.vectorLayerToSvgString(startOutVl, startOutVl.width, startOutVl.height);
  const endSvg = SvgSerializer.vectorLayerToSvgString(endOutVl, endOutVl.width, endOutVl.height);

  const zip = new JSZip();
  zip.file('README.txt', createExportReadme());
  const android = zip.folder('android');
  const avd = AvdSerializer.vectorLayerAnimationToAvdXmlString(startOutVl, avdTargets);
  android.file('animated_vector_drawable.xml', avd);
  const startVd = AvdSerializer.vectorLayerToVectorDrawableXmlString(startOutVl);
  android.file('start_vector_drawable.xml', startVd);
  const endVd = AvdSerializer.vectorLayerToVectorDrawableXmlString(endOutVl);
  android.file('end_vector_drawable.xml', endVd);
  const web = zip.folder('web');
  const svg = web.folder('svg');
  svg.file('start.svg', startSvg);
  svg.file('end.svg', endSvg);
  if (SHOULD_EXPORT_CSS_KEYFRAMES) {
    // Create a CSS keyframe animation.
    const keyframes = web.folder('keyframes');
    keyframes.file('keyframes.html', KeyframesSerializer.createHtml(startSvg, 'keyframes.css'));
    keyframes.file('keyframes.css', KeyframesSerializer.createCss(svgTargets));
  }
  if (SHOULD_EXPORT_JS_SCRIPT) {
    // Create JS animation loop HTML file.
    const jsLoopHtml = JsSerializer.svgAnimationToScript(startSvg, svgTargets);
    web.folder('js').file('animation.html', jsLoopHtml);
  }
  if (SHOULD_EXPORT_SVG_SPRITE) {
    // Create an svg sprite animation.
    const svgSprite =
      SpriteSerializer.createSvg(startVl, endVl, duration, interpolator);
    const cssSprite =
      SpriteSerializer.createCss(startVl.width, startVl.height, duration);
    const htmlSprite = SpriteSerializer.createHtml('sprite.svg', 'sprite.css');
    const sprite = web.folder('sprite');
    sprite.file('sprite.html', htmlSprite);
    sprite.file('sprite.css', cssSprite);
    sprite.file('sprite.svg', svgSprite);
  }
  zip.generateAsync({ type: 'blob' }).then(content => {
    downloadFile(content, 'ShapeShifter.zip');
  });
}

function createAlphaAvdTarget(
  startLayer: VectorLayer,
  endLayer: VectorLayer,
  duration: number,
  interpolator: string) {

  if (startLayer.alpha === endLayer.alpha) {
    return undefined;
  }
  const fromValue = startLayer.alpha;
  const toValue = endLayer.alpha;
  return new AvdTarget(startLayer.id,
    [new AvdAnimation(
      fromValue.toString(),
      toValue.toString(),
      duration,
      interpolator,
      'alpha',
      'floatType')]);
}

function createRotationAvdTarget(
  startLayer: GroupLayer,
  endLayer: GroupLayer,
  duration: number,
  interpolator: string) {

  if (!startLayer || !endLayer || startLayer.rotation === endLayer.rotation) {
    return undefined;
  }
  const fromValue = startLayer.rotation;
  const toValue = endLayer.rotation;
  return new AvdTarget(startLayer.id,
    [new AvdAnimation(
      fromValue.toString(),
      toValue.toString(),
      duration,
      interpolator,
      'rotation',
      'floatType')]);
}

function createPathAvdTarget(
  startLayer: PathLayer,
  endLayer: PathLayer,
  duration: number,
  interpolator: string) {

  const createAvdAnimation = (from: string, to: string, propertyName: AvdPropertyName, valueType: AvdValueType) => {
    return new AvdAnimation(from, to, duration, interpolator, propertyName, valueType);
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

function createOpacitySvgTarget(
  startLayer: VectorLayer,
  endLayer: VectorLayer,
  duration: number,
  interpolator: string) {

  if (startLayer.alpha === endLayer.alpha) {
    return undefined;
  }
  const fromValue = startLayer.alpha;
  const toValue = endLayer.alpha;
  return new SvgTarget(startLayer.id,
    [new SvgAnimation(
      fromValue.toString(),
      toValue.toString(),
      duration,
      interpolator,
      'opacity')]);
}

function createRotationSvgTarget(
  startLayer: GroupLayer,
  endLayer: GroupLayer,
  duration: number,
  interpolator: string) {

  if (!startLayer || !endLayer || startLayer.rotation === endLayer.rotation) {
    return undefined;
  }
  const fromValue = startLayer.rotation;
  const toValue = endLayer.rotation;
  return new SvgTarget(startLayer.id,
    [new SvgAnimation(
      `rotate(${fromValue.toString()})`,
      `rotate(${toValue.toString()})`,
      duration,
      interpolator,
      'transform')]);
}

function createPathSvgTarget(
  startLayer: PathLayer,
  endLayer: PathLayer,
  duration: number,
  interpolator: string) {

  const createSvgAnimation = (from: string, to: string, propertyName: SvgPropertyName) => {
    return new SvgAnimation(from, to, duration, interpolator, propertyName);
  };
  const svgAnimations: SvgAnimation[] = [];
  svgAnimations.push(
    createSvgAnimation(
      `${startLayer.pathData.getPathString()}`,
      `${endLayer.pathData.getPathString()}`,
      'd'));
  if (startLayer.fillColor && endLayer.fillColor && startLayer.fillColor !== endLayer.fillColor) {
    svgAnimations.push(
      createSvgAnimation(
        ColorUtil.androidToCssColor(startLayer.fillColor),
        ColorUtil.androidToCssColor(endLayer.fillColor),
        'fill'));
  }
  if (startLayer.strokeColor && endLayer.strokeColor && startLayer.strokeColor !== endLayer.strokeColor) {
    svgAnimations.push(
      createSvgAnimation(
        ColorUtil.androidToCssColor(startLayer.strokeColor),
        ColorUtil.androidToCssColor(endLayer.strokeColor),
        'stroke'));
  }
  if (startLayer.fillAlpha !== endLayer.fillAlpha) {
    svgAnimations.push(
      createSvgAnimation(
        startLayer.fillAlpha.toString(), endLayer.fillAlpha.toString(), 'fill-opacity'));
  }
  if (startLayer.strokeAlpha !== endLayer.strokeAlpha) {
    svgAnimations.push(
      createSvgAnimation(
        startLayer.strokeAlpha.toString(), endLayer.strokeAlpha.toString(), 'stroke-opacity'));
  }
  if (startLayer.strokeWidth !== endLayer.strokeWidth) {
    svgAnimations.push(
      createSvgAnimation(
        startLayer.strokeWidth.toString(), endLayer.strokeWidth.toString(), 'stroke-width'));
  }
  return new SvgTarget(startLayer.id, svgAnimations);
}


function createExportReadme() {
  return `=== Files exported by Shape Shifter ===

This archive contains the following:

web/
  - start.svg
  - end.svg

android/
  - start_vector_drawable.xml
  - end_vector_drawable.xml
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
