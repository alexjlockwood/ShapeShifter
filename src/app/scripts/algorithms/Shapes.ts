import { Path } from 'app/model/paths';
import { MathUtil } from 'app/scripts/common';
import { polygonCentroid } from 'd3-polygon';

import { Ring } from './Types';

type Rings = ReadonlyArray<Ring>;

/**
 * Returns an array such that the value 'j' at the ith index 'i' tells you that
 * from[i] maps to to[j].
 */
export function findBestSubPathMapping(from: Rings | Path, to: Rings | Path) {
  const toRingFn = (obj: Rings | Path): Rings => {
    return Array.isArray(obj)
      ? obj as Rings
      : (obj as Path).getSubPaths().map(s =>
          s.getCommands().map(c => {
            const { x, y } = c.getEnd();
            return [x, y] as [number, number];
          }),
        );
  };
  const fromRings = toRingFn(from);
  const toRings = toRingFn(to);

  if (fromRings.length > 8) {
    // Avoid permuting large arrays.
    return fromRings.map((d, i) => i);
  }

  const distances: ReadonlyTable<number> = fromRings.map(p1 =>
    toRings.map(p2 => squaredDistance(p1, p2)),
  );
  let min = Infinity;
  let best = fromRings.map((d, i) => i);
  (function permute(arr: number[], order: ReadonlyArray<number> = [], sum = 0) {
    for (let i = 0; i < arr.length; i++) {
      const cur = arr.splice(i, 1);
      const dist = distances[cur[0]][order.length];
      if (sum + dist < min) {
        if (arr.length) {
          permute([...arr], [...order, ...cur], sum + dist);
        } else {
          min = sum + dist;
          best = [...order, ...cur];
        }
      }
      if (arr.length) {
        arr.splice(i, 0, cur[0]);
      }
    }
  })(best);
  return best as ReadonlyArray<number>;
}

/**
 * Returns the squared distance between two ring's centroids.
 */
function squaredDistance(r1: Ring, r2: Ring) {
  return MathUtil.distance(polygonCentroid(r1), polygonCentroid(r2)) ** 2;
}
