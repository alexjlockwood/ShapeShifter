import { SvgTarget } from '../animation';

export function svgAnimationToScript(svg: string, svgTargets: SvgTarget[]) {
  // We assume here that the same duration and interpolator will be used for all targets.
  const duration = svgTargets[0].animations[0].duration;
  // const interpolator = svgTargets[0].animations[0].interpolator;
  // const animations = svgTargets.map(target => createCssAnimation(target.layerId, duration, interpolator));
  // const keyframes = svgTargets.map(target => svgTargetToCssKeyframes(target.layerId, target));
  return `<!DOCTYPE html>
<html>
<head>
  <title>Shape Shifter animation (JS)</title>
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
  </style>
  <script type="text/javascript">
    document.addEventListener("DOMContentLoaded", function () {
${createScript(duration, svgTargets)}
    });
  </script>
</head>
<body>
  ${svg}
</body>
</html>
`;
}

function createScript(duration: number, svgTargets: SvgTarget[]) {
  const layerId = svgTargets[0].layerId;
  const startPath = svgTargets[0].animations[0].valueFrom;
  const endPath = svgTargets[0].animations[0].valueTo;
  return `
const element = document.getElementById("${layerId}");
element.removeAttribute('d');
const fastOutSlowIn = createBezierEasing(0.4, 0, 0.2, 1);
const fastOutLinearIn = createBezierEasing(0.4, 0, 1, 1);
const linearOutSlowIn = createBezierEasing(0, 0, 0.2, 1);

let isEndState = false;

(function loop() {
  beginAnimation(!isEndState);
  isEndState = !isEndState;
  setTimeout(() => loop(), 1000);
})();

function beginAnimation(isAnimatingToEndState) {
  let startingTimestamp = undefined;
  const onAnimationFrame = currentTimestamp => {
    if (!startingTimestamp) {
      startingTimestamp = currentTimestamp;
    }
    const shouldRequestNextFrame = (currentTimestamp - startingTimestamp) < ${duration};
    const currentMillis = Math.min(currentTimestamp - startingTimestamp, ${duration});
    const startPath = '${startPath}';
    const endPath = '${endPath}';
    updateElement(element, startPath, endPath, currentMillis, isAnimatingToEndState);
    if (shouldRequestNextFrame) {
      window.requestAnimationFrame(onAnimationFrame);
    } else {
      startingTimestamp = undefined;
    }
  };
  window.requestAnimationFrame(onAnimationFrame);
}

function updateElement(element, startPath, endPath, currentMillis, isAnimatingToEndState) {
  const t = fastOutSlowIn(clamp(currentMillis, 0, ${duration}) / ${duration});
  const start = startPath.split(' ');
  const end = endPath.split(' ');
  const path = start.map((c, i) => isNaN(c) ? c : (lerp(t, +start[i], +end[i])).toString()).join(' ');
  element.setAttribute('d', path);
}

function lerp(t, a, b) {
  return a + (b - a) * t;
}

function clamp(num, min, max) {
  return Math.min(Math.max(num, min), max);
}

function createBezierEasing(mX1, mY1, mX2, mY2) {
  if (!(0 <= mX1 && mX1 <= 1 && 0 <= mX2 && mX2 <= 1)) {
    throw new Error('bezier x values must be in [0, 1] range');
  }

  const NEWTON_ITERATIONS = 4;
  const NEWTON_MIN_SLOPE = 0.001;
  const SUBDIVISION_PRECISION = 0.0000001;
  const SUBDIVISION_MAX_ITERATIONS = 10;
  const kSplineTableSize = 11;
  const kSampleStepSize = 1 / (kSplineTableSize - 1);

  const A = (aA1, aA2) => 1 - 3 * aA2 + 3 * aA1;
  const B = (aA1, aA2) => 3 * aA2 - 6 * aA1;
  const C = aA1 => 3 * aA1;

  // Returns x(t) given t, x1, and x2, or y(t) given t, y1, and y2.
  const calcBezier = (aT, aA1, aA2) => {
    return ((A(aA1, aA2) * aT + B(aA1, aA2)) * aT + C(aA1)) * aT;
  };

  // Returns dx/dt given t, x1, and x2, or dy/dt given t, y1, and y2.
  const getSlope = (aT, aA1, aA2) => {
    return 3 * A(aA1, aA2) * aT * aT + 2 * B(aA1, aA2) * aT + C(aA1);
  };

  const binarySubdivide = (aX, aA, aB, mX1, mX2) => {
    let currentX, currentT, i = 0;
    do {
      currentT = aA + (aB - aA) / 2;
      currentX = calcBezier(currentT, mX1, mX2) - aX;
      if (currentX > 0) {
        aB = currentT;
      } else {
        aA = currentT;
      }
    } while (Math.abs(currentX) > SUBDIVISION_PRECISION && ++i < SUBDIVISION_MAX_ITERATIONS);
    return currentT;
  };

  const newtonRaphsonIterate = (aX, aGuessT, mX1, mX2) => {
    for (let i = 0; i < NEWTON_ITERATIONS; i++) {
      const currentSlope = getSlope(aGuessT, mX1, mX2);
      if (currentSlope === 0) {
        return aGuessT;
      }
      const currentX = calcBezier(aGuessT, mX1, mX2) - aX;
      aGuessT -= currentX / currentSlope;
    }
    return aGuessT;
  };

  // Precompute samples table.
  const sampleValues = new Float32Array(kSplineTableSize);
  if (mX1 !== mY1 || mX2 !== mY2) {
    for (let i = 0; i < kSplineTableSize; i++) {
      sampleValues[i] = calcBezier(i * kSampleStepSize, mX1, mX2);
    }
  }

  const getTForX = aX => {
    let intervalStart = 0;
    let currentSample = 1;
    const lastSample = kSplineTableSize - 1;

    for (; currentSample !== lastSample && sampleValues[currentSample] <= aX; ++currentSample) {
      intervalStart += kSampleStepSize;
    }
    --currentSample;

    // Interpolate to provide an initial guess for t.
    const dist = (aX - sampleValues[currentSample]) / (sampleValues[currentSample + 1] - sampleValues[currentSample]);
    const guessForT = intervalStart + dist * kSampleStepSize;

    const initialSlope = getSlope(guessForT, mX1, mX2);
    if (initialSlope >= NEWTON_MIN_SLOPE) {
      return newtonRaphsonIterate(aX, guessForT, mX1, mX2);
    } else if (initialSlope === 0) {
      return guessForT;
    } else {
      return binarySubdivide(aX, intervalStart, intervalStart + kSampleStepSize, mX1, mX2);
    }
  };

  return x => {
    if (mX1 === mY1 && mX2 === mY2) {
      return x; // Linear.
    }
    // Because JavaScript number are imprecise, we should guarantee the extremes are right.
    if (x === 0) {
      return 0;
    }
    if (x === 1) {
      return 1;
    }
    return calcBezier(getTForX(x), mY1, mY2);
  };
}`;
}

// function interpolatePath(startPath: string, endPath: string) {
//   const start = startPath.split(' ');
//   const end = endPath.split(' ');
//   return start.map((c: any, i) => isNaN(c) ? c : (+end[i] - +start[i]).toString()).join(' ');
// }

// function createBezierEasing(mX1, mY1, mX2, mY2) {
//   return `
// `;
// }
