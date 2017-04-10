import { SvgTarget } from '../animation';

export function svgAnimationToHtml(startSvg: string, svgTargets: SvgTarget[]) {
  // We assume here that the same duration and interpolator will be used for all targets.
  const duration = svgTargets[0].animations[0].duration;
  const interpolator = svgTargets[0].animations[0].interpolator;
  const animations = svgTargets.map(target => createCssAnimation(target.layerId, duration, interpolator));
  const keyframes = svgTargets.map(target => svgTargetToCssKeyframes(target.layerId, target));
  return `<!DOCTYPE html>
<html>
<head>
  <title>Shape Shifter CSS transition</title>
  <style>
    ${keyframes.join('\n')}
    ${animations.join('\n')}
  </style>
</head>
<body>
  ${startSvg}
</body>
</html>
`;
}

function createCssAnimation(layerId: string, duration: number, interpolator: string) {
  return `#${layerId} {
  animation: ${layerId}_animation ${duration}ms alternate infinite ${interpolator};
}`;
}

function svgTargetToCssKeyframes(layerId: string, svgTarget: SvgTarget) {
  const fromProps: string[] = [];
  for (const anim of svgTarget.animations) {
    fromProps.push(`${anim.propertyName}: ${anim.valueFrom}`);
  }
  const toProps: string[] = [];
  for (const anim of svgTarget.animations) {
    toProps.push(`${anim.propertyName}: ${anim.valueTo}`);
  }
  return `@keyframes ${layerId}_animation {
from {
  ${fromProps.join(';\n    ')}
}
to {
  ${toProps.join(';\n    ')}
}
}`;
}

