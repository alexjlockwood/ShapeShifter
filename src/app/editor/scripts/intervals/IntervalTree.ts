/**
 * A naive implementation of an interval tree with O(n) search performance.
 */
export class IntervalTree<T> {
  private readonly intervals: Interval<T>[] = [];

  /**
   * Note that inserted numbers are automatically rounded to the nearest integer.
   */
  insert(low: number, high: number, data: T) {
    low = Math.round(low);
    high = Math.round(high);
    this.intervals.push({ low, high, data });
  }

  /**
   * Check if the interval (low, high) intersects with any intervals in the tree.
   * An extra predicateFn can be supplied to further filter the results.
   */
  intersectsWith(low: number, high: number, predicateFn = (data: T) => true) {
    return this.intervals.some(interval => {
      return low < interval.high && interval.low < high && predicateFn(interval.data);
    });
  }
}

interface Interval<T> {
  readonly low: number;
  readonly high: number;
  readonly data: T;
}
