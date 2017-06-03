// import { Interpolator } from '../interpolators';
// import {
//   LayerUtil,
//   VectorLayer,
// } from '../layers';
// import { Svgo } from '../svgo';
// import { SvgSerializer } from '.';

// export function createHtml(svgFileName: string, cssFileName: string) {
//   return `<html>
// <head>
//   <link rel="stylesheet" type="text/css" href="${cssFileName}"/>
// </head>
// <body>
//   <div class="shapeshifter play" style="background-image: url(${svgFileName})"></div>
// </body>
// </html>
// `;
// }

// export function createCss(width: number, height: number, duration: number, numSteps: number) {
//   return createKeyframes(width, numSteps) + `
// .shapeshifter {
//   animation-duration: ${duration}ms;
//   animation-timing-function: steps(${numSteps});
//   width: ${width}px;
//   height: ${height}px;
//   background-repeat: no-repeat;
// }
// .shapeshifter.play {
//   animation-name: play${numSteps};
// }
// `;
// }

// function createKeyframes(width: number, numSteps: number) {
//   return `@keyframes play${numSteps} {
//   0% {
//     background-position: 0px 0px;
//   }
//   100% {
//     background-position: -${numSteps * width}px 0px;
//   }
// }`;
// }

// export function createSvgSprite(
//   start: VectorLayer,
//   end: VectorLayer,
//   interpolator: Interpolator,
//   numSteps: number) {

//   const preview = start.deepClone();
//   const svgs: string[] = [];
//   const { width, height } = preview;
//   for (let i = 0; i <= numSteps; i++) {
//     const fraction = interpolator.interpolateFn(i / numSteps);
//     LayerUtil.deepInterpolate(start, preview, end, fraction);
//     svgs.push(SvgSerializer.vectorLayerToSvgString(preview, width, height, width * i, 0, false));
//   }
//   const totalWidth = width * numSteps;
//   let svg = `<svg xmlns="http://www.w3.org/2000/svg" `
//     + `viewBox="0 0 ${totalWidth} ${height}" width="${totalWidth}px" height="${height}px">
// ${svgs.join('\n')}
// </svg>
// `;
//   Svgo.optimize(svg, optimizedSvgText => {
//     svg = optimizedSvgText;
//   });
//   return svg;
// }

// export function createSvgFrames(
//   start: VectorLayer,
//   end: VectorLayer,
//   interpolator: Interpolator,
//   numSteps: number) {

//   const preview = start.deepClone();
//   const svgs: string[] = [];
//   const { width, height } = preview;
//   for (let i = 0; i <= numSteps; i++) {
//     const fraction = interpolator.interpolateFn(i / numSteps);
//     LayerUtil.deepInterpolate(start, preview, end, fraction);
//     svgs.push(SvgSerializer.vectorLayerToSvgString(preview, width, height));
//   }
//   return svgs;
// }
