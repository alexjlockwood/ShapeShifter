import { Boolean } from './helpers';

type Keyframe<T> = MidKeyframe<T> | LastKeyframe<T>;

interface MidKeyframe<T> {
  /** The start time in frames. */
  t: number;
  /** The start value of the segment. */
  s: [T];
  /** The end value of the segment. */
  e: [T];
  /** The interpolation curve out point. */
  o: { x: [number]; y: [number] };
  /** The interpolation curve in point. */
  i: { x: [number]; y: [number] };
}

interface LastKeyframe<T> {
  /** The start time in frames. */
  t: number;
}

type Property<T> = StaticProperty<T> | AnimatedProperty<T>;

interface StaticProperty<T> {
  /** A single value or list of keyframes. */
  k: T;
  /** Indicates whether or not the property is animated. */
  a: Boolean.False;
}

interface AnimatedProperty<T> {
  /** A single value or list of keyframes. */
  k: Keyframe<T>[];
  /** Indicates whether or not the property is animated. */
  a: Boolean.True;
}

export type MultiDimensionalProperty = Property<number[]>;

export type ShapeProperty = Property<{
  /** Defines whether or not the shape is closed. */
  c: boolean;
  /** The bezier curve out points of the shape. Expressed in coordinates relative to the vertex. */
  o: [number, number][];
  /** The bezier curve in points of the shape. Expressed in coordinates relative to the vertex. */
  i: [number, number][];
  /** The bezier curve vertices of the shape. Expressed in coordinates relative to the vertex. */
  v: [number, number][];
}>;

export type ValueProperty = Property<number>;
