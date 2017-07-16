declare module 'bezier-js';
declare module 'element-resize-detector';

interface Dictionary<T> {
  [index: string]: T;
}

type ReadonlyTable<T> = ReadonlyArray<ReadonlyArray<T>>;
