// TODO: add 'a' attribute to indicate whether it is animated or not animated
export interface Property<T> {
  k: T | Keyframe<T>[];
}

// TODO: ask Hernan if non-bezier interpolation curves are supported
// TODO: ask Hernan how the 'end time' of a keyframe should be specified in a list of keyframes
interface Keyframe<T> {
  // The start time in frames (i.e. the 'startOffset' in an AVD). Always `startOffsetMillis * framerate / 1000`.
  t: number;
  // The start value of the segment (i.e. the 'valueFrom' in an AVD).
  s: [T];
  // The end value of the segment (i.e. the 'valueTo' in an AVD).
  e: [T];
  // The interpolation curve in point.
  i: { x: [number]; y: [number] };
  // The interpolation curve out point.
  o: { x: [number]; y: [number] };
}
