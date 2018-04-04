interface Dictionary<T> {
  [index: string]: T;
}

type ReadonlyTable<T> = ReadonlyArray<ReadonlyArray<T>>;
