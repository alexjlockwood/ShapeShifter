// import { StateService } from '../../services';
// import { ActionSource } from '../../store';
// import { ColorUtil } from '../common';
// import { Interpolator } from '../interpolators';
// import { GroupLayer, PathLayer, VectorLayer } from '../layers';
// import { AvdSerializer, SvgSerializer } from '.';
// import {
//   AvdAnimation,
//   AvdPropertyName,
//   AvdTarget,
//   AvdValueType,
// } from './AvdTarget';
// import * as KeyframesSerializer from './KeyframesSerializer';
// import * as SpriteSerializer from './SpriteSerializer';
// import {
//   SvgAnimation,
//   SvgPropertyName,
//   SvgTarget,
// } from './SvgTarget';
// import * as $ from 'jquery';
// import * as JSZip from 'jszip';
// import * as _ from 'lodash';

// // TODO: round SVG coordinates in exported sprite sheets?
// // TODO: also export the original SVG files?
// // TODO: generate non-cubic-bezier interpolators correctly
// // TODO: round widths/heights to nearest pixel to avoid weird offsets

// const EXPORTED_FPS = [30, 60];

// export function generateZip(
//   stateService: StateService,
//   duration: number,
//   interpolator: Interpolator) {

//   const startVlChildren: Array<PathLayer | GroupLayer> = [];
//   const endVlChildren: Array<PathLayer | GroupLayer> = [];

//   // Create AvdTargets.
//   const avdTargets: AvdTarget[] = [];
//   const startVl = stateService.getVectorLayer(ActionSource.From);
//   const endVl = stateService.getVectorLayer(ActionSource.To);

//   // Create vector layer target.
//   const alphaTarget =
//     createAlphaAvdTarget(
//       startVl,
//       endVl,
//       duration,
//       interpolator.androidRef);
//   if (alphaTarget) {
//     avdTargets.push(alphaTarget);
//   }

//   const startGl = stateService.getActiveRotationLayer(ActionSource.From);
//   const endGl = stateService.getActiveRotationLayer(ActionSource.To);

//   // Create rotation layer target.
//   const rotationTarget =
//     createRotationAvdTarget(
//       startGl,
//       endGl,
//       duration,
//       interpolator.androidRef);
//   const startPl = stateService.getActivePathLayer(ActionSource.From);
//   const endPl = stateService.getActivePathLayer(ActionSource.To);
//   if (rotationTarget) {
//     avdTargets.push(rotationTarget);
//     startVlChildren.push(startGl);
//     endVlChildren.push(endGl);
//   } else {
//     startVlChildren.push(startPl);
//     endVlChildren.push(endPl);
//   }

//   // Create path layer target.
//   avdTargets.push(
//     createPathAvdTarget(
//       startPl,
//       endPl,
//       duration,
//       interpolator.androidRef));

//   // Create VectorLayers.
//   const startOutVl =
//     new VectorLayer({
//       id: startVl.id,
//       children: startVlChildren,
//       name: startVl.name,
//       width: startVl.width,
//       height: startVl.height,
//       alpha: startVl.alpha,
//     });
//   const endOutVl =
//     new VectorLayer({
//       id: endVl.id,
//       children: endVlChildren,
//       name: endVl.name,
//       width: endVl.width,
//       height: endVl.height,
//       alpha: endVl.alpha,
//     });

//   // Create SvgTargets.
//   const svgTargets: SvgTarget[] = [];

//   // Create vector layer target.
//   const opacitySvgTarget =
//     createOpacitySvgTarget(
//       startVl,
//       endVl,
//       duration,
//       interpolator.webRef);
//   if (opacitySvgTarget) {
//     svgTargets.push(opacitySvgTarget);
//   }

//   // Create rotation layer target.
//   const rotationSvgTarget =
//     createRotationSvgTarget(
//       startGl,
//       endGl,
//       duration,
//       interpolator.webRef);
//   if (rotationSvgTarget) {
//     svgTargets.push(rotationSvgTarget);
//   }

//   // Create path layer target.
//   svgTargets.push(
//     createPathSvgTarget(
//       startPl,
//       endPl,
//       duration,
//       interpolator.webRef));

//   const zip = new JSZip();
//   const android = zip.folder('android');
//   const web = zip.folder('web');
//   zip.file('README.txt', createExportReadme());

//   const avd = AvdSerializer.vectorLayerAnimationToAvdXmlString(startOutVl, avdTargets);
//   android.file('animated_vector_drawable.xml', avd);
//   const startVd = AvdSerializer.vectorLayerToVectorDrawableXmlString(startOutVl);
//   android.file('start_vector_drawable.xml', startVd);
//   const endVd = AvdSerializer.vectorLayerToVectorDrawableXmlString(endOutVl);
//   android.file('end_vector_drawable.xml', endVd);

//   // Export standalone SVG frames.
//   const svg = web.folder('svg');

//   EXPORTED_FPS.forEach(fps => {
//     const numSteps = Math.ceil(duration / 1000 * fps);
//     const svgs = SpriteSerializer.createSvgFrames(startVl, endVl, interpolator, numSteps);
//     const length = (numSteps - 1).toString().length;
//     const fpsFolder = svg.folder(`${fps}fps`);
//     svgs.forEach((s, i) => {
//       fpsFolder.file(`frame${_.padStart(i.toString(), length, '0')}.svg`, s);
//     });
//   });

//   // Create a CSS keyframe animation.
//   const keyframes = web.folder('keyframes');
//   const startSvg = SvgSerializer.vectorLayerToSvgString(startOutVl, startOutVl.width, startOutVl.height);
//   keyframes.file('keyframes.html', KeyframesSerializer.createHtml(startSvg, 'keyframes.css'));
//   keyframes.file('keyframes.css', KeyframesSerializer.createCss(svgTargets, duration, interpolator.webRef));

//   // Create an svg sprite animation.
//   const sprite = web.folder('sprite');
//   EXPORTED_FPS.forEach(fps => {
//     const numSteps = Math.ceil(duration / 1000 * fps);
//     const svgSprite =
//       SpriteSerializer.createSvgSprite(startVl, endVl, interpolator, numSteps);
//     const cssSprite =
//       SpriteSerializer.createCss(startVl.width, startVl.height, duration, numSteps);
//     const fileName = `sprite_${fps}fps`;
//     const htmlSprite = SpriteSerializer.createHtml(`${fileName}.svg`, `${fileName}.css`);
//     const spriteFolder = sprite.folder(`${fps}fps`);
//     spriteFolder.file(`${fileName}.html`, htmlSprite);
//     spriteFolder.file(`${fileName}.css`, cssSprite);
//     spriteFolder.file(`${fileName}.svg`, svgSprite);
//   });

//   zip.generateAsync({ type: 'blob' }).then(content => {
//     downloadFile(content, 'ShapeShifter.zip');
//   });
// }

// function createAlphaAvdTarget(
//   startLayer: VectorLayer,
//   endLayer: VectorLayer,
//   duration: number,
//   interpolator: string) {

//   if (startLayer.alpha === endLayer.alpha) {
//     return undefined;
//   }
//   const fromValue = startLayer.alpha;
//   const toValue = endLayer.alpha;
//   return new AvdTarget(startLayer.name,
//     [new AvdAnimation(
//       fromValue.toString(),
//       toValue.toString(),
//       duration,
//       interpolator,
//       'alpha',
//       'floatType')]);
// }

// function createRotationAvdTarget(
//   startLayer: GroupLayer,
//   endLayer: GroupLayer,
//   duration: number,
//   interpolator: string) {

//   if (!startLayer || !endLayer || startLayer.rotation === endLayer.rotation) {
//     return undefined;
//   }
//   const fromValue = startLayer.rotation;
//   const toValue = endLayer.rotation;
//   return new AvdTarget(startLayer.name,
//     [new AvdAnimation(
//       fromValue.toString(),
//       toValue.toString(),
//       duration,
//       interpolator,
//       'rotation',
//       'floatType')]);
// }

// function createPathAvdTarget(
//   startLayer: PathLayer,
//   endLayer: PathLayer,
//   duration: number,
//   interpolator: string) {

//   const createAvdAnimation = (from: string, to: string, propertyName: AvdPropertyName, valueType: AvdValueType) => {
//     return new AvdAnimation(from, to, duration, interpolator, propertyName, valueType);
//   };
//   const avdAnimations: AvdAnimation[] = [];
//   avdAnimations.push(
//     createAvdAnimation(
//       startLayer.pathData.getPathString(),
//       endLayer.pathData.getPathString(),
//       'pathData',
//       'pathType'));
//   if (startLayer.fillColor && endLayer.fillColor && startLayer.fillColor !== endLayer.fillColor) {
//     avdAnimations.push(
//       createAvdAnimation(startLayer.fillColor, endLayer.fillColor, 'fillColor', 'colorType'));
//   }
//   if (startLayer.strokeColor && endLayer.strokeColor && startLayer.strokeColor !== endLayer.strokeColor) {
//     avdAnimations.push(
//       createAvdAnimation(startLayer.strokeColor, endLayer.strokeColor, 'strokeColor', 'colorType'));
//   }
//   if (startLayer.fillAlpha !== endLayer.fillAlpha) {
//     avdAnimations.push(
//       createAvdAnimation(
//         startLayer.fillAlpha.toString(), endLayer.fillAlpha.toString(), 'fillAlpha', 'floatType'));
//   }
//   if (startLayer.strokeAlpha !== endLayer.strokeAlpha) {
//     avdAnimations.push(
//       createAvdAnimation(
//         startLayer.strokeAlpha.toString(), endLayer.strokeAlpha.toString(), 'strokeAlpha', 'floatType'));
//   }
//   if (startLayer.strokeWidth !== endLayer.strokeWidth) {
//     avdAnimations.push(
//       createAvdAnimation(
//         startLayer.strokeWidth.toString(), endLayer.strokeWidth.toString(), 'strokeWidth', 'floatType'));
//   }
//   return new AvdTarget(startLayer.name, avdAnimations);
// }

// function createOpacitySvgTarget(
//   startLayer: VectorLayer,
//   endLayer: VectorLayer,
//   duration: number,
//   interpolator: string) {

//   if (startLayer.alpha === endLayer.alpha) {
//     return undefined;
//   }
//   const fromValue = startLayer.alpha;
//   const toValue = endLayer.alpha;
//   return new SvgTarget(startLayer.name,
//     [new SvgAnimation(
//       fromValue.toString(),
//       toValue.toString(),
//       duration,
//       interpolator,
//       'opacity')]);
// }

// function createRotationSvgTarget(
//   startLayer: GroupLayer,
//   endLayer: GroupLayer,
//   duration: number,
//   interpolator: string) {

//   if (!startLayer || !endLayer || startLayer.rotation === endLayer.rotation) {
//     return undefined;
//   }
//   // TODO: pivotX/pivotY can technically be animatable... although ShapeShifter
//   // currently doesn't make it possible.
//   const svgAnimations: SvgAnimation[] = [];
//   svgAnimations.push(
//     new SvgAnimation(
//       `rotate(${startLayer.rotation}deg)`,
//       `rotate(${endLayer.rotation}deg)`,
//       duration,
//       interpolator,
//       'transform'));
//   // TODO: check to see if this animates properly if/when we ever support animating pivot points
//   svgAnimations.push(
//     new SvgAnimation(
//       `${startLayer.pivotX}px ${startLayer.pivotY}px`,
//       `${endLayer.pivotX}px ${endLayer.pivotY}px`,
//       duration,
//       interpolator,
//       'transform-origin'));
//   return new SvgTarget(startLayer.name, svgAnimations);
// }

// function createPathSvgTarget(
//   startLayer: PathLayer,
//   endLayer: PathLayer,
//   duration: number,
//   interpolator: string) {

//   const createSvgAnimation = (from: string, to: string, propertyName: SvgPropertyName) => {
//     return new SvgAnimation(from, to, duration, interpolator, propertyName);
//   };
//   const svgAnimations: SvgAnimation[] = [];
//   svgAnimations.push(
//     createSvgAnimation(
//       `${startLayer.pathData.getPathString()}`,
//       `${endLayer.pathData.getPathString()}`,
//       'd'));
//   if (startLayer.fillColor && endLayer.fillColor && startLayer.fillColor !== endLayer.fillColor) {
//     svgAnimations.push(
//       createSvgAnimation(
//         ColorUtil.androidToCssHexColor(startLayer.fillColor),
//         ColorUtil.androidToCssHexColor(endLayer.fillColor),
//         'fill'));
//   }
//   if (startLayer.strokeColor && endLayer.strokeColor && startLayer.strokeColor !== endLayer.strokeColor) {
//     svgAnimations.push(
//       createSvgAnimation(
//         ColorUtil.androidToCssHexColor(startLayer.strokeColor),
//         ColorUtil.androidToCssHexColor(endLayer.strokeColor),
//         'stroke'));
//   }
//   if (startLayer.fillAlpha !== endLayer.fillAlpha) {
//     svgAnimations.push(
//       createSvgAnimation(
//         startLayer.fillAlpha.toString(), endLayer.fillAlpha.toString(), 'fill-opacity'));
//   }
//   if (startLayer.strokeAlpha !== endLayer.strokeAlpha) {
//     svgAnimations.push(
//       createSvgAnimation(
//         startLayer.strokeAlpha.toString(), endLayer.strokeAlpha.toString(), 'stroke-opacity'));
//   }
//   if (startLayer.strokeWidth !== endLayer.strokeWidth) {
//     svgAnimations.push(
//       createSvgAnimation(
//         startLayer.strokeWidth.toString(), endLayer.strokeWidth.toString(), 'stroke-width'));
//   }
//   return new SvgTarget(startLayer.name, svgAnimations);
// }

// function createExportReadme() {
//   return `=== Assets exported by Shape Shifter (https://shapeshifter.design) ===

// This archive contains the following directories:

// android/
//   - Contains an AnimatedVectorDrawable resource file that plays the
//     the generated animation.
//   - Also contains two VectorDrawable resource files that can be used separately
//     as standalone drawable assets.
//   - Check out the 'further reading' section below to learn more about how to
//     use VectorDrawables and AnimatedVectorDrawables in your Android app.

// web/
//   svg/
//     - Contains standalone SVG frames representing the in-between states of
//       the generated animation. Assets are generated in both 30fps and 60fps.
//   sprite/
//     - Contains a SVG spritesheet that plays the generated animation. Assets
//       are generated in both 30fps and 60fps.
//   keyframes/
//     - Contains CSS keyframes files that play the generated animation. Note
//       that as of April 2017, only Blink-based browsers have implemented
//       support for this feature.

// If you have an export format that you'd like to see added, please file
// a feature request using the link below!

// Further reading:

//   - Shape Shifter landing page:
//     https://shapeshifter.design

//   - Shape Shifter source code:
//     https://github.com/alexjlockwood/ShapeShifter

//   - File a bug or feature request here:
//     https://github.com/alexjlockwood/ShapeShifter/issues

//   - Introduction to Icon Animations blog post:
//     http://www.androiddesignpatterns.com/2016/11/introduction-to-icon-animation-techniques.html

//   - Animated Vector Drawable sample Android application:
//     https://github.com/alexjlockwood/adp-delightful-details

//   - VectorDrawable & AnimatedVectorDrawable developer training docs:
//     https://developer.android.com/guide/topics/graphics/vector-drawable-resources.html

// (c) 2017 Alex Lockwood
// `;
// }

// function downloadFile(content: Blob, fileName: string) {
//   const url = window.URL.createObjectURL(content);
//   const anchor = $('<a>').hide().appendTo(document.body);
//   anchor.attr({ href: url, download: fileName });
//   anchor.get(0).click();
//   window.URL.revokeObjectURL(url);
// }
