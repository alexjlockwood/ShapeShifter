import * as ColorUtil from './ColorUtil';
import * as MathUtil from './MathUtil';
import * as ModelUtil from './ModelUtil';
export * from './Matrix';
export { ColorUtil, MathUtil, ModelUtil };

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface Rect {
  readonly l: number;
  readonly t: number;
  readonly r: number;
  readonly b: number;
}
