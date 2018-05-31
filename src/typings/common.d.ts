interface Dictionary<T> {
  [index: string]: T;
}

// A readonly 2D array.
type ReadonlyTable<T> = ReadonlyArray<ReadonlyArray<T>>;

// An object with values that can be null.
type Nullable<T> = { [P in keyof T]: T[P] | null };

// A generic constructor type.
type Constructor<T = {}> = new (...args: any[]) => T;
