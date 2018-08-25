import { Property } from './property';

export type Shape = GroupShape | PathShape | TransformShape;

interface GroupShape {
  // The shape type. Always 'gr'.
  ty: 'gr';
  // The group's children shapes.
  it: Shape[];
}

// TODO: finish this
interface PathShape {
  // The shape type. Always 'sh'.
  ty: 'sh';
}

// TODO: ask Hernan what he means by 'the position needs to compensate the pivot value' in his sample bodymovin file
interface TransformShape {
  // The shape type. Always 'tr'.
  ty: 'tr';
  // The anchor point.
  a: Property<[number, number]>;
  // The opacity (default opacity is 100).
  o: Property<number>;
  // The position.
  p: Property<[number, number]>;
  // The rotation (in degrees).
  r: Property<number>;
  // The scale (default scale is 100).
  s: Property<[number, number]>;
  // The skew angle (in degrees). Always 0.
  sa: Property<0>;
  // The skew. Always 0.
  sk: Property<0>;
}

// TODO: ask Hernan why 'r' is missing from the bodymovin docs
interface FillShape {
  // The shape type. Always 'fl'.
  ty: 'fl';
  // The fill color.
  c: AnimatableProperty<Color>;
  // The fill-opacity (default opacity is 100).
  o: AnimatableProperty<number>;
  // The fill rule (1 - nonzero, 2 - evenodd).
  r: 1 | 2;
}

interface StrokeShape {
  // The shape type. Always 'st'.
  ty: 'st';
  // The stroke color.
  c: AnimatableProperty<Color>;
  // The stroke-opacity (default opacity is 100).
  o: AnimatableProperty<number>;
  // The stroke-width.
  w: AnimatableProperty<number>;
  // The stroke line cap (1 - 'butt', 2 - 'round', 3 - 'square').
  lc: 1 | 2 | 3;
  // The stroke line join (1 - 'miter', 2 - 'round', 3 - 'bevel').
  lj: 1 | 2 | 3;
  // The stroke miter limit (only applicable if the stroke line join is 'miter').
  ml: number;
}
