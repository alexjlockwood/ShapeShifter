import { VectorLayer } from 'app/model/layers';
import { Animation } from 'app/model/timeline';
import { AnimationRenderer } from 'app/scripts/animator';
import { Svgo } from 'app/scripts/svgo';

import * as SvgSerializer from './SvgSerializer';

export function createHtml(svgFileName: string, cssFileName: string) {
  return `<html>
<head>
  <link rel="stylesheet" type="text/css" href="${cssFileName}"/>
</head>
<body>
  <div class="shapeshifter play" style="background-image: url(${svgFileName})"></div>
</body>
</html>
`;
}

export function createCss(width: number, height: number, duration: number, numSteps: number) {
  return (
    createKeyframes(width, numSteps) +
    `
.shapeshifter {
  animation-duration: ${duration}ms;
  animation-timing-function: steps(${numSteps});
  width: ${width}px;
  height: ${height}px;
  background-repeat: no-repeat;
}
.shapeshifter.play {
  animation-name: play${numSteps};
}
`
  );
}

function createKeyframes(width: number, numSteps: number) {
  return `@keyframes play${numSteps} {
  0% {
    background-position: 0px 0px;
  }
  100% {
    background-position: -${numSteps * width}px 0px;
  }
}`;
}

export function createSvgFrames(vectorLayer: VectorLayer, animation: Animation, numSteps: number) {
  const renderer = new AnimationRenderer(vectorLayer, animation);
  const svgs: string[] = [];
  const { width, height } = vectorLayer;
  for (let i = 0; i <= numSteps; i++) {
    const time = i / numSteps * animation.duration;
    svgs.push(SvgSerializer.toSvgString(renderer.setAnimationTime(time), width, height));
  }
  return svgs;
}

export function createSvgSprite(vectorLayer: VectorLayer, animation: Animation, numSteps: number) {
  const renderer = new AnimationRenderer(vectorLayer, animation);
  const svgs: string[] = [];
  const { width, height } = vectorLayer;
  for (let i = 0; i <= numSteps; i++) {
    const time = i / numSteps * animation.duration;
    const vl = renderer.setAnimationTime(time);
    svgs.push(SvgSerializer.toSvgString(vl, width, height, width * i, 0, false, i.toString()));
  }
  const totalWidth = width * numSteps + width;
  let svg =
    `<svg xmlns="http://www.w3.org/2000/svg" ` +
    `viewBox="0 0 ${totalWidth} ${height}" width="${totalWidth}px" height="${height}px">
${svgs.join('\n')}
</svg>
`;
  Svgo.optimize(svg, optimizedSvgText => (svg = optimizedSvgText));
  return svg;
}
