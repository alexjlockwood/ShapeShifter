export { SvgChar } from './SvgChar';
export { PathCommand, Projection } from './PathCommand';
export { SubPathCommand } from './SubPathCommand';
export { Command, Index } from './Command';
export { newPathCommand } from './PathCommandImpl';
import * as AutoAwesome from './AutoAwesome';
export { AutoAwesome };
export {
  newMove, newLine, newQuadraticCurve,
  newBezierCurve, newClosePath,
} from './CommandImpl';
