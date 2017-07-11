import { polygonLength } from 'd3-polygon';

import { distance, pointAlong } from './Math';
import { Point, Ring } from './Types';

export function addPoints(ring: Ring, numPoints: number, maxLength = Infinity) {
  const desiredLength = ring.length + numPoints;
  const step = polygonLength(ring) / numPoints;

  let i = 0;
  let cursor = 0;
  let insertAt = step / 2;

  while (ring.length < desiredLength) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    const segment = distance(a, b);

    if (insertAt <= cursor + segment) {
      ring.splice(
        i + 1,
        0,
        segment ? pointAlong(a, b, (insertAt - cursor) / segment) : a.slice(0) as Point,
      );
      insertAt += step;
      continue;
    }

    cursor += segment;
    i++;
  }
}

export function bisect(ring: Ring, maxSegmentLength = Infinity) {
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    let b = i === ring.length - 1 ? ring[0] : ring[i + 1];

    // Could splice the whole set for a segment instead, but a bit messy
    while (distance(a, b) > maxSegmentLength) {
      b = pointAlong(a, b, 0.5);
      ring.splice(i + 1, 0, b);
    }
  }
}
