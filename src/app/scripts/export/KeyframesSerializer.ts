import { SvgTarget } from './SvgTarget';

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

export function createCss(svgTargets: SvgTarget[], duration: number, interpolator: string) {
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
