import { Path } from 'app/model/paths';

import { INVALID_INPUT } from './Errors';
import { isFiniteNumber } from './Math';
import { normalizeRing } from './Normalize';
import { Point, Ring } from './Types';

function parse(str: string) {
  return new Path(str);
}

function split(parsed: Path) {
  return parsed
    .getPathString()
    .split('M')
    .map((d, i) => {
      d = d.trim();
      return i && d ? 'M' + d : d;
    })
    .filter(d => d);
}

export function toPathString(ring: Ring) {
  return 'M' + ring.join('L') + 'Z';
}

export function splitPathString(str: string) {
  return split(parse(str));
}

export function pathStringToRing(str: string, maxSegmentLength: number) {
  const parsed = parse(str);
  return exactRing(parsed) || approximateRing(parsed, maxSegmentLength);
}

function exactRing(parsed: Path) {
  const commands = parsed.getCommands();
  if (!commands.length || commands.some(c => c.getSvgChar() === 'Q' || c.getSvgChar() === 'C')) {
    return false;
  }
  const ring = commands.map(c => [c.getEnd().x, c.getEnd().y] as Point);
  return ring.length ? { ring } : false;
}

function approximateRing(parsed: Path, maxSegmentLength: number) {
  const ringPath = split(parsed)[0];

  if (!ringPath) {
    throw new TypeError(INVALID_INPUT);
  }

  const ring: Ring = [];
  let numPoints = 3;

  const m = new Path(ringPath);
  const len = m.getPathLength();

  if (maxSegmentLength && isFiniteNumber(maxSegmentLength) && maxSegmentLength > 0) {
    numPoints = Math.max(numPoints, Math.ceil(len / maxSegmentLength));
  }

  for (let i = 0; i < numPoints; i++) {
    const p = m.getPointAtLength(len * i / numPoints);
    ring.push([p.x, p.y]);
  }

  return {
    ring,
    skipBisect: true,
  };
}
