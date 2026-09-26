import _ from 'lodash';

import { assign } from './Hungarian';

describe('assign', () => {
  const totalCost = (costs: number[][], cols: number[]) =>
    _.sum(cols.map((col, row) => costs[row][col]));

  /** Tries every assignment, which is only fast enough for small tables. */
  function bruteForceCost(costs: number[][]) {
    const numCols = costs[0].length;
    let best = Infinity;
    (function recurse(row: number, used: Set<number>, cost: number) {
      if (row === costs.length) {
        best = Math.min(best, cost);
        return;
      }
      for (let col = 0; col < numCols; col++) {
        if (!used.has(col)) {
          used.add(col);
          recurse(row + 1, used, cost + costs[row][col]);
          used.delete(col);
        }
      }
    })(0, new Set(), 0);
    return best;
  }

  it('pairs rows with the cheapest columns', () => {
    expect(
      assign([
        [4, 1, 3],
        [2, 0, 5],
        [3, 2, 2],
      ]),
    ).toEqual([1, 0, 2]);
  });

  it('leaves the most expensive columns unpaired when there are more columns', () => {
    expect(
      assign([
        [9, 1, 9, 9],
        [9, 9, 9, 2],
      ]),
    ).toEqual([1, 3]);
  });

  it('handles no rows', () => {
    expect(assign([])).toEqual([]);
  });

  it.each([Infinity, NaN])('rejects a cost of %d', cost => {
    expect(() => assign([[cost, cost]])).toThrow();
  });

  it('rejects more rows than columns', () => {
    expect(() => assign([[1], [2]])).toThrow();
  });

  it('finds the cheapest assignment of random tables', () => {
    let seed = 1;
    const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 200; i++) {
      const numRows = 1 + Math.floor(random() * 5);
      const numCols = numRows + Math.floor(random() * 3);
      const costs = _.times(numRows, () => _.times(numCols, () => Math.round(random() * 20)));
      const cols = assign(costs);
      expect(new Set(cols).size).toBe(numRows);
      expect(totalCost(costs, cols)).toBeCloseTo(bruteForceCost(costs));
    }
  });
});
