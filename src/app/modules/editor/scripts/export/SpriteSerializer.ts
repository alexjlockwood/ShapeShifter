import { VectorLayer } from 'app/modules/editor/model/layers';
import { Animation } from 'app/modules/editor/model/timeline';
import { AnimationRenderer } from 'app/modules/editor/scripts/animator';
import { optimizeSvg } from 'app/modules/editor/scripts/svgo';

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
    const time = (i / numSteps) * animation.duration;
    svgs.push(SvgSerializer.toSvgString(renderer.setCurrentTime(time), width, height));
  }
  return svgs;
}

export function createSvgSprite(vectorLayer: VectorLayer, animation: Animation, numSteps: number) {
  const renderer = new AnimationRenderer(vectorLayer, animation);
  const svgs: string[] = [];
  const { width, height } = vectorLayer;
  for (let i = 0; i <= numSteps; i++) {
    const time = (i / numSteps) * animation.duration;
    const vl = renderer.setCurrentTime(time);
    svgs.push(SvgSerializer.toSvgSpriteFrameString(vl, width * i, 0, i.toString()));
  }
  const totalWidth = width * numSteps + width;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" ` +
    `viewBox="0 0 ${totalWidth} ${height}" width="${totalWidth}" height="${height}">
${svgs.join('\n')}
</svg>
`;
  return optimizeSvg(svg, false);
}
