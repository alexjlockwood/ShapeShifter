import { SvgTarget } from '../animation';

// TODO: add css prefixes to support all browsers
export function createHtml(svgText: string, cssFileName: string) {
  return `<html>
<head>
  <link rel="stylesheet" type="text/css" href="${cssFileName}" />
</head>
<body>
${svgText}
</body>
</html>
`;
}

export function createCss(svgTargets: SvgTarget[]) {
  // We assume here that the same duration and interpolator will be used for all targets.
  const duration = svgTargets[0].animations[0].duration;
  const interpolator = svgTargets[0].animations[0].interpolator;
  const animations = svgTargets.map(target => createCssAnimation(target.layerId, duration, interpolator));
  const keyframes = svgTargets.map(target => svgTargetToCssKeyframes(target.layerId, target));
  return `
${keyframes.join('\n')}
${animations.join('\n')}
`;
}

function createCssAnimation(layerId: string, duration: number, interpolator: string) {
  return `#${layerId} {
  animation: ${layerId}_animation ${duration}ms ${interpolator} forwards;
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
    @keyframes ${layerId}_animation {
      from {
        ${fromProps.join(';\n      ')}
      }
      to {
        ${toProps.join(';\n      ')}
      }
    }`;
}

