// Path geometry for drawing the playground's morphs and measuring them. It's separate from the
// editor's path model on purpose, so that the measurements stay the same when the model changes.
// It reads the absolute M, L, Q, C, and Z commands that Path.getPathString() writes, and nothing
// else.

export type CommandType = 'M' | 'L' | 'Q' | 'C' | 'Z';

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface Command {
  readonly type: CommandType;
  /** The control points, if any, then the end point. A Z ends at its subpath's start. */
  readonly points: ReadonlyArray<Point>;
}

/** A subpath's commands, starting with its M. */
export type SubPath = ReadonlyArray<Command>;

export type Kind = 'fill' | 'stroke';

const NUM_POINTS: Readonly<Record<CommandType, number>> = { M: 1, L: 1, Q: 2, C: 3, Z: 0 };

const isCommandType = (s: string): s is CommandType => s in NUM_POINTS;

/** Parses a path string like the ones Path.getPathString() writes. Throws on anything else. */
export function parsePath(pathString: string): SubPath[] {
  const tokens = pathString.match(/[a-zA-Z]|[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g) ?? [];
  const subPaths: Command[][] = [];
  let i = 0;
  while (i < tokens.length) {
    const type = tokens[i++];
    if (!isCommandType(type)) {
      throw new Error(`Only absolute M, L, Q, C, and Z commands are supported, not ${type}`);
    }
    const points: Point[] = [];
    for (let j = 0; j < NUM_POINTS[type]; j++) {
      const x = Number(tokens[i++]);
      const y = Number(tokens[i++]);
      if (Number.isNaN(x) || Number.isNaN(y)) {
        throw new Error(`Expected numbers after ${type}`);
      }
      points.push({ x, y });
    }
    if (type === 'M') {
      subPaths.push([]);
    }
    const subPath = subPaths[subPaths.length - 1];
    if (!subPath) {
      throw new Error('A path has to start with M');
    }
    subPath.push({ type, points: type === 'Z' ? [subPath[0].points[0]] : points });
  }
  return subPaths;
}

export function toPathString(subPaths: ReadonlyArray<SubPath>) {
  return subPaths
    .flat()
    .map(({ type, points }) =>
      type === 'Z' ? 'Z' : [type, ...points.flatMap(p => [round(p.x), round(p.y)])].join(' '),
    )
    .join(' ');
}

const round = (n: number) => Math.round(n * 1000) / 1000;

export const endPoint = (command: Command) => command.points[command.points.length - 1];

/**
 * Returns why two paths can't be morphed, or undefined if they can. Like AnimatedVectorDrawable
 * and Path.isMorphableWith, this requires the same commands in the same order.
 */
export function findMismatch(a: ReadonlyArray<SubPath>, b: ReadonlyArray<SubPath>) {
  const commandsA = a.flat();
  const commandsB = b.flat();
  if (commandsA.length !== commandsB.length) {
    return `${commandsA.length} commands vs. ${commandsB.length}`;
  }
  const i = commandsA.findIndex((c, j) => c.type !== commandsB[j].type);
  return i < 0 ? undefined : `command ${i + 1} is ${commandsA[i].type} vs. ${commandsB[i].type}`;
}

/** Interpolates between two morphable paths, the way AnimatedVectorDrawable does. */
export function interpolate(
  a: ReadonlyArray<SubPath>,
  b: ReadonlyArray<SubPath>,
  t: number,
): SubPath[] {
  return a.map((subPath, s) =>
    subPath.map((command, c) => ({
      type: command.type,
      points: command.points.map((p, i) => {
        const q = b[s][c].points[i];
        return { x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t };
      }),
    })),
  );
}

/** Returns points along a subpath, with curves flattened into short lines. */
export function flatten(subPath: SubPath, stepsPerCurve = 16): Point[] {
  const points: Point[] = [];
  let previous: Point | undefined;
  for (const command of subPath) {
    const end = endPoint(command);
    if (previous && (command.type === 'Q' || command.type === 'C')) {
      const controlPoints = [previous, ...command.points];
      for (let step = 1; step <= stepsPerCurve; step++) {
        points.push(bezierPoint(controlPoints, step / stepsPerCurve));
      }
    } else {
      points.push(end);
    }
    previous = end;
  }
  return points;
}

function bezierPoint(controlPoints: ReadonlyArray<Point>, t: number): Point {
  let points = controlPoints;
  while (points.length > 1) {
    points = points.slice(1).map((p, i) => ({
      x: points[i].x + (p.x - points[i].x) * t,
      y: points[i].y + (p.y - points[i].y) * t,
    }));
  }
  return points[0];
}

/**
 * Returns the area a subpath encloses, positive when it's drawn clockwise on screen (with y
 * pointing down). Like a fill, it treats an open subpath as if it were closed.
 */
export function signedArea(subPath: SubPath) {
  const points = flatten(subPath);
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const q = points[(i + 1) % points.length];
    area += p.x * q.y - q.x * p.y;
  }
  return area / 2;
}

export interface Metrics {
  /** How far a point moves during the morph, on average, as a fraction of the paths' size. */
  readonly meanTravel: number;
  /** How far the point that moves the most moves, as a fraction of the paths' size. */
  readonly maxTravel: number;
  /**
   * The number of subpaths drawn clockwise at one end of the morph and not at the other, not
   * counting open strokes.
   */
  readonly oppositeWindings: number;
  /**
   * For fills, the smallest area in the middle of the morph, as a fraction of the area expected
   * there (in between the start and end areas). A subpath that turns inside out gets close to 0.
   */
  readonly worstArea: number | undefined;
}

/** Measures the morph between two morphable paths. */
export function measure(a: ReadonlyArray<SubPath>, b: ReadonlyArray<SubPath>, kind: Kind): Metrics {
  const size = diagonal([...a, ...b].flatMap(s => flatten(s)));

  const travels = a.flatMap((subPath, s) =>
    subPath.flatMap((command, c) =>
      // A Z ends where its M starts, so it would count the start point twice.
      command.type === 'Z' ? [] : [distance(endPoint(command), endPoint(b[s][c])) / size],
    ),
  );

  // A collapsing subpath has no area, so it has no direction either. Neither does an open stroke,
  // since nothing fills it.
  const minArea = size * size * 1e-6;
  const oppositeWindings = a.filter((subPath, s) => {
    if (kind === 'stroke' && !(isClosed(subPath) && isClosed(b[s]))) {
      return false;
    }
    const areaA = signedArea(subPath);
    const areaB = signedArea(b[s]);
    return Math.abs(areaA) > minArea && Math.abs(areaB) > minArea && areaA > 0 !== areaB > 0;
  }).length;

  let worstArea: number | undefined;
  if (kind === 'fill') {
    const totalArea = (subPaths: ReadonlyArray<SubPath>) =>
      subPaths.reduce((sum, s) => sum + Math.abs(signedArea(s)), 0);
    const startArea = totalArea(a);
    const endArea = totalArea(b);
    for (const t of [0.25, 0.5, 0.75]) {
      const expected = startArea + (endArea - startArea) * t;
      if (expected > minArea) {
        const ratio = totalArea(interpolate(a, b, t)) / expected;
        worstArea = worstArea === undefined ? ratio : Math.min(worstArea, ratio);
      }
    }
  }

  return {
    meanTravel: travels.length ? travels.reduce((sum, d) => sum + d, 0) / travels.length : 0,
    maxTravel: travels.length ? Math.max(...travels) : 0,
    oppositeWindings,
    worstArea,
  };
}

function isClosed(subPath: SubPath) {
  const start = endPoint(subPath[0]);
  const end = endPoint(subPath[subPath.length - 1]);
  return subPath[subPath.length - 1].type === 'Z' || (start.x === end.x && start.y === end.y);
}

const distance = (p: Point, q: Point) => Math.hypot(p.x - q.x, p.y - q.y);

function diagonal(points: ReadonlyArray<Point>) {
  if (!points.length) {
    return 1;
  }
  const xs = points.map(p => p.x);
  const ys = points.map(p => p.y);
  const d = Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  return d || 1;
}
