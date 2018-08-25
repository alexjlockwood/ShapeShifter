// // TODO: check if '5.1.16' is the most recent version number
// const bodymovinVersion = '5.1.16';
// const framerate = 60;

// ///////////////////////////////////////////////
// //////////////////// ROOT ////////////////////
// ///////////////////////////////////////////////

// interface Bodymovin {
//   // List of rasterized assets. Always an empty array.
//   assets: [];
//   // The framerate of the animation. Always 60.
//   fr: typeof framerate;
//   // The bodymovin version. Always the latest version.
//   v: typeof bodymovinVersion;
//   // The in point of the animation in frames. Always 0.
//   ip: 0;
//   // The out point of the animation in frames. Always `animDurationMillis * framerate / 1000`.
//   op: number;
//   // The name of the animation.
//   nm: string;
//   // The width of the composition.
//   w: number;
//   // The height of the composition.
//   h: number;
//   // The list containing the single root shape layer.
//   layers: [ShapeLayer];
// }

// ////////////////////////////////////////////////
// //////////////////// LAYERS ////////////////////
// ////////////////////////////////////////////////

// // TODO: ask Hernan if it is required that the 'ks' transforms be declared if we just need their default values
// // TODO: ask Hernan if it is required that the 'ks' transforms be declared using 3-dimensional values
// interface ShapeLayer {
//   // The layer type. Always 4.
//   ty: 4;
//   // The layer index. Always 1 (since we assume there will only be a single layer).
//   ind: 1;
//   // The start value of the layer. Always 0.
//   st: 0;
//   // The in point of the animation in frames. Always 0.
//   ip: 0;
//   // The out point of the animation in frames. Always `animDurationMillis * framerate / 1000`.
//   op: 0;
//   // The object with all transformations for the layer. Always set to the default values
//   // (we will set/animate transforms on the shapes instead).
//   ks: {
//     // The anchor point.
//     a: Property<[0, 0, 0]>;
//     // The opacity (default opacity is 100).
//     o: Property<100>;
//     // The rotation (in degrees).
//     r: Property<0>;
//     // The scale (default scale is 100).
//     s: Property<[100, 100, 100]>;
//   };
//   shapes: Shape[];
// }

// ////////////////////////////////////////////////
// //////////////////// SHAPES ////////////////////
// ////////////////////////////////////////////////

// type Shape = GroupShape | PathShape | TransformShape;

// interface GroupShape {
//   // The shape type. Always 'gr'.
//   ty: 'gr';
//   // The group's children shapes.
//   it: Shape[];
// }

// // TODO: finish this
// interface PathShape {
//   // The shape type. Always 'sh'.
//   ty: 'sh';
// }

// // TODO: ask Hernan what he means by 'the position needs to compensate the pivot value' in his sample bodymovin file
// interface TransformShape {
//   // The shape type. Always 'tr'.
//   ty: 'tr';
//   // The anchor point.
//   a: AnimatableProperty<[number, number]>;
//   // The opacity (default opacity is 100).
//   o: AnimatableProperty<number>;
//   // The position.
//   p: AnimatableProperty<[number, number]>;
//   // The rotation (in degrees).
//   r: AnimatableProperty<number>;
//   // The scale (default scale is 100).
//   s: AnimatableProperty<[number, number]>;
//   // The skew angle (in degrees). Always 0.
//   sa: Property<0>;
//   // The skew. Always 0.
//   sk: Property<0>;
// }

// // TODO: ask Hernan why 'r' is missing from the bodymovin docs
// interface FillShape {
//   // The shape type. Always 'fl'.
//   ty: 'fl';
//   // The fill color.
//   c: AnimatableProperty<Color>;
//   // The fill-opacity (default opacity is 100).
//   o: AnimatableProperty<number>;
//   // The fill rule (1 - nonzero, 2 - evenodd).
//   r: 1 | 2;
// }

// interface StrokeShape {
//   // The shape type. Always 'st'.
//   ty: 'st';
//   // The stroke color.
//   c: AnimatableProperty<Color>;
//   // The stroke-opacity (default opacity is 100).
//   o: AnimatableProperty<number>;
//   // The stroke-width.
//   w: AnimatableProperty<number>;
//   // The stroke line cap (1 - 'butt', 2 - 'round', 3 - 'square').
//   lc: 1 | 2 | 3;
//   // The stroke line join (1 - 'miter', 2 - 'round', 3 - 'bevel').
//   lj: 1 | 2 | 3;
//   // The stroke miter limit (only applicable if the stroke line join is 'miter').
//   ml: number;
// }

// ////////////////////////////////////////////////////
// //////////////////// PROPERTIES ////////////////////
// ////////////////////////////////////////////////////

// // A property that cannot be animated.
// interface Property<T> {
//   k: T;
// }

// // A property that can be animated.
// interface AnimatableProperty<T> {
//   k: T | KeyFrame<T>[];
// }

// // TODO: ask Hernan if non-bezier interpolation curves are supported
// // TODO: ask Hernan how the 'end time' of a keyframe should be specified in a list of keyframes
// interface KeyFrame<T> {
//   // The start time in frames (i.e. the 'startOffset' in an AVD). Always `startOffsetMillis * framerate / 1000`.
//   t: number;
//   // The start value of the segment (i.e. the 'valueFrom' in an AVD).
//   s: [T];
//   // The end value of the segment (i.e. the 'valueTo' in an AVD).
//   e: [T];
//   // The interpolation curve in point.
//   i: { x: [number]; y: [number] };
//   // The interpolation curve out point.
//   o: { x: [number]; y: [number] };
// }

// ///////////////////////////////////////////////
// //////////////////// TYPES ////////////////////
// ///////////////////////////////////////////////

// // TODO: ask Hernan if this is the correct definition of a bodymovin color (specifically the last 'alpha' number)
// // An RGBA color. The first 3 numbers are integers in [0,255]. The fourth number is a number in [0,1].
// type Color = [number, number, number, number];
