import { polygonCentroid } from 'd3-polygon';

import { distance } from './Math';
import { Ring } from './Types';

export function pieceOrder(start: Ring[], end: Ring[]) {
  const distances = start.map(p1 => end.map(p2 => squaredDistance(p1, p2)));
  const order = bestOrder(start, end, distances);

  // Don't permute huge array
  if (start.length > 8) {
    return start.map((d, i) => i);
  }
  return bestOrder(start, end, distances);
}

export function bestOrder(start: Ring[], end: Ring[], distances: number[][]) {
  let min = Infinity;
  let best = start.map((d, i) => i);

  function permute(arr: number[], order = [], sum = 0) {
    for (let i = 0; i < arr.length; i++) {
      const cur = arr.splice(i, 1);
      const dist = distances[cur[0]][order.length];
      if (sum + dist < min) {
        if (arr.length) {
          permute(arr.slice(), order.concat(cur), sum + dist);
        } else {
          min = sum + dist;
          best = order.concat(cur);
        }
      }
      if (arr.length) {
        arr.splice(i, 0, cur[0]);
      }
    }
  }

  permute(best);
  return best;
}

function squaredDistance(p1: Ring, p2: Ring) {
  const d = distance(polygonCentroid(p1), polygonCentroid(p2));
  return d * d;
}
