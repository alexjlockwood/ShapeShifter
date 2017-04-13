import * as _ from 'lodash';
import { SvgSerializer } from '.';
import { Interpolator } from '../animation';
import { VectorLayer, LayerUtil } from '../layers';

const MILLIS_BETWEEN_FRAMES = 40;

export function createHtml(svgFileName: string, cssFileName: string) {
  return `<html>
<body>
  <div class="shapeshifter play" style="background-image: url(${svgFileName})" data-iteration="infinite"></div>
  <style>@import "${cssFileName}" all;</style>
</body>
</html>
`;
}

export function createCss(width: number, height: number, duration: number) {
  const numSteps = _.round(duration / MILLIS_BETWEEN_FRAMES);
  const prefixes = ['-webkit-', '-moz-', '-o-', ''];
  const animationDurations = prefixes.map(prefix => {
    return `  ${prefix}animation-duration: ${duration}ms;`;
  }).join('\n');
  const animationTimings = prefixes.map(prefix => {
    return `  ${prefix}animation-timing-function: steps(${numSteps - 1});`;
  }).join('\n');
  const iterationCounts = prefixes.map(prefix => {
    return `  ${prefix}animation-iteration-count: infinite;`;
  }).join('\n');
  const fillModes = prefixes.map(prefix => {
    return `  ${prefix}animation-fill-mode: both;`;
  }).join('\n');
  const animationNames = prefixes.map(prefix => {
    return `  ${prefix}animation-name: play${numSteps};`;
  }).join('\n');
  return createKeyframes(width, duration) + `
.shapeshifter {
${animationDurations}
${animationTimings}
  width: ${width}px;
  height: ${height}px;
  background-repeat: no-repeat;
}
.shapeshifter[data-iteration="infinite"] {
${iterationCounts}
${fillModes}
}
.shapeshifter.play {
${animationNames}
}
`;
}

function createKeyframes(width: number, duration: number) {
  const numSteps = _.round(duration / MILLIS_BETWEEN_FRAMES);
  return ['@-webkit-', '@-moz-', '@-o-', '@'].map(prefix => {
    return `${prefix}keyframes play${numSteps} {
  0% {
    background-position: -${width}px 0px;
  }
  100% {
    background-position: -${numSteps * width}px 0px;
  }
}`;
  }).join('\n');
}

export function createSvg(
  start: VectorLayer,
  end: VectorLayer,
  duration: number,
  interpolator: Interpolator,
  width: number,
  height: number) {

  const preview = start.clone();
  const numSteps = _.round(duration / MILLIS_BETWEEN_FRAMES);
  const svgs: string[] = [];
  for (let i = 0; i < numSteps; i++) {
    const fraction = interpolator.interpolateFn(i / numSteps);
    LayerUtil.deepInterpolate(start, preview, end, fraction);
    svgs.push(SvgSerializer.vectorLayerToSvgString(preview, width, height, width * i, 0));
  }
  const totalWidth = width * numSteps;
  return `<?xml version="1.0" encoding="utf-8"?>
<svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth} ${height} width="${totalWidth}px" height="${height}px">
${svgs.join('\n')}
</svg>
`;
}

