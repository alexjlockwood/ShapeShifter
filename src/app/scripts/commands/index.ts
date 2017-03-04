import * as AutoAwesome from './AutoAwesome';
export { AutoAwesome };
export { SvgChar } from './SvgChar';
export { Path, Projection } from './Path';
export { SubPath } from './SubPath';
export { Command, Index } from './Command';
export { newPath } from './PathImpl';
export {
  newMove, newLine, newQuadraticCurve,
  newBezierCurve, newClosePath,
} from './CommandImpl';
