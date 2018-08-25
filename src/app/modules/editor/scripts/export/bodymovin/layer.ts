export type Layer = ShapeLayer;

interface ShapeLayer {
  // The layer type. Always 4.
  ty: 4;
  // The layer index.
  ind: number;
  // The start time of the layer. Always 0.
  st: number;
  // The in point of the animation in frames. Always 0.
  ip: number;
  // The out point of the animation in frames. Always `animDurationMillis * framerate / 1000`.
  op: number;
  // The object with all transformations for the layer. Always set to the default values
  // (we will set/animate transforms on the shapes instead).
  ks: {
    // The anchor point.
    a: Property<[0, 0, 0]>;
    // The opacity (default opacity is 100).
    o: Property<100>;
    // The rotation (in degrees).
    r: Property<0>;
    // The scale (default scale is 100).
    s: Property<[100, 100, 100]>;
  };
  shapes: Shape[];
}
