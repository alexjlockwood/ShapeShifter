import { SvgTarget } from '../animation';

// TODO: add css prefixes to support all browsers
export function svgAnimationToHtml(svg: string, svgTargets: SvgTarget[]) {
  // We assume here that the same duration and interpolator will be used for all targets.
  const duration = svgTargets[0].animations[0].duration;
  const interpolator = svgTargets[0].animations[0].interpolator;
  const animations = svgTargets.map(target => createCssAnimation(target.layerId, duration, interpolator));
  const keyframes = svgTargets.map(target => svgTargetToCssKeyframes(target.layerId, target));
  return `<!DOCTYPE html>
<html>
<head>
  <title>Shape Shifter animation (CSS)</title>
  <style>
    body {
      position: absolute;
      margin: auto;
      top: 0;
      right: 0;
      bottom: 0;
      left: 0;
      width: 50%;
    }
    ${keyframes.join('\n')}
    ${animations.join('\n')}
  </style>
</head>
<body>
  ${svg}
</body>
</html>
`;
}

function createCssAnimation(layerId: string, duration: number, interpolator: string) {
  return `#${layerId} {
  animation: ${layerId}_anim ${duration}ms ${interpolator} forwards;
}`;
}

function svgTargetToCssKeyframes(layerId: string, svgTarget: SvgTarget) {
  const fromProps: string[] = [];
  const toProps: string[] = [];
  for (const anim of svgTarget.animations) {
    let valueFrom = anim.valueFrom;
    let valueTo = anim.valueTo;
    if (anim.propertyName === 'd') {
      valueFrom = `path('${valueFrom}')`;
      valueTo = `path('${valueTo}')`;
    }
    fromProps.push(`${anim.propertyName}: ${valueFrom}`);
    toProps.push(`${anim.propertyName}: ${valueTo}`);
  }
  return `
    @keyframes ${layerId}_anim {
      from {
        ${fromProps.join(';\n      ')}
      }
      to {
        ${toProps.join(';\n      ')}
      }
    }`;
}

