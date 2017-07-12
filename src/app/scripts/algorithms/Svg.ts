import { Path } from 'app/model/paths';
import * as _ from 'lodash';

import { Point, Ring } from './Types';

export function toPathString(ring: Ring) {
  return 'M' + ring.join('L') + 'Z';
}

export function splitPathString(str: string) {
  return split(new Path(str));
}

function split(parsed: Path) {
  return parsed
    .getPathString()
    .split('M')
    .map((d, i) => {
      d = d.trim();
      return i && d ? 'M' + d : d;
    })
    .filter(d => !!d);
}

export function pathStringToRing(
  str: string,
  maxSegmentLength: number,
): {
  readonly ring: Ring;
  readonly skipBisect?: boolean;
} {
  const parsed = new Path(str);
  return exactRing(parsed) || approximateRing(parsed, maxSegmentLength);
}

function exactRing(parsed: Path) {
  const commands = parsed.getCommands();
  if (!commands.length || commands.some(c => c.getSvgChar() === 'Q' || c.getSvgChar() === 'C')) {
    return undefined;
  }
  const ring = commands.map(c => [c.getEnd().x, c.getEnd().y] as Point);
  return ring.length ? { ring } : undefined;
}

function approximateRing(parsed: Path, maxSegmentLength: number) {
  const ringPath = split(parsed)[0];

  if (!ringPath) {
    throw new TypeError(
      'All shapes must be supplied as arrays of [x, y] points or an SVG path string',
    );
  }

  const ring: Ring = [];
  let numPoints = 3;

  const m = new Path(ringPath);
  const len = m.getPathLength();

  if (maxSegmentLength && _.isFinite(maxSegmentLength) && maxSegmentLength > 0) {
    numPoints = Math.max(numPoints, Math.ceil(len / maxSegmentLength));
  }

  for (let i = 0; i < numPoints; i++) {
    const p = m.getPointAtLength(len * i / numPoints);
    ring.push([p.x, p.y]);
  }

  return { ring, skipBisect: true };
}
