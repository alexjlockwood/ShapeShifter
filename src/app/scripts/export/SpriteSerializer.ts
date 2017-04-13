import { SvgSerializer } from '.';
import { Interpolator } from '../animation';
import { VectorLayer, LayerUtil } from '../layers';
import { Svgo } from '../svgo';

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

export function createCss(width: number, height: number, duration: number) {
  const numSteps = getNumSteps(duration);
  const prefixes = ['-webkit-', '-moz-', '-o-', ''];
  const animationDurations = prefixes.map(prefix => {
    return `  ${prefix}animation-duration: ${duration}ms;`;
  }).join('\n');
  const animationTimings = prefixes.map(prefix => {
    return `  ${prefix}animation-timing-function: steps(${numSteps});`;
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
.shapeshifter.play {
${animationNames}
}
`;
}

function createKeyframes(width: number, duration: number) {
  const numSteps = getNumSteps(duration);
  return ['@-webkit-', '@-moz-', '@-o-', '@'].map(prefix => {
    return `${prefix}keyframes play${numSteps} {
  0% {
    background-position: 0px 0px;
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
  interpolator: Interpolator) {

  const preview = start.clone();
  const numSteps = getNumSteps(duration);
  const svgs: string[] = [];
  const { width, height } = preview;
  for (let i = 0; i < numSteps; i++) {
    const fraction = interpolator.interpolateFn(i / numSteps);
    LayerUtil.deepInterpolate(start, preview, end, fraction);
    svgs.push(SvgSerializer.vectorLayerToSvgString(preview, width, height, width * i, 0));
  }
  const totalWidth = width * numSteps;
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth} ${height}" width="${totalWidth}px" height="${height}px">
${svgs.join('\n')}
</svg>
`;
  Svgo.optimize(svg, optimizedSvgText => {
    svg = optimizedSvgText;
  });
  return svg;
}

function getNumSteps(durationMillis: number) {
  return Math.floor(durationMillis / 48);
}
