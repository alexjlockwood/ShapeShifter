import { useMemo } from 'react';

import {
  Kind,
  SubPath,
  endPoint,
  findMismatch,
  interpolate,
  parsePath,
  toPathString,
} from './geometry';
import { ViewBox } from './scenarios';

/** The size of each view, in CSS pixels. */
export const VIEW_SIZE = 220;

/** The number of steps in the --order-* colors in playground.css. */
const NUM_ORDER_COLORS = 10;

const ONION_FRAMES = [0, 0.25, 0.5, 0.75, 1];

export interface Overlays {
  /** Shows each command's end point, colored by its order in its subpath. */
  readonly points: boolean;
  /** Shows the line each end point moves along. */
  readonly travel: boolean;
  /** Shows the morph at a few points in time, behind the current frame. */
  readonly onion: boolean;
}

interface MorphViewProps {
  readonly from: string;
  readonly to: string;
  readonly t: number;
  readonly kind: Kind;
  readonly viewBox: ViewBox;
  readonly overlays: Overlays;
}

/**
 * Draws the morph between two paths at time t. Paths that can't be morphed are drawn on top of
 * each other instead, with the start dashed, along with the points of both.
 */
export function MorphView({ from, to, t, kind, viewBox, overlays }: MorphViewProps) {
  const morph = useMemo(() => prepare(from, to), [from, to]);
  const [x, y, width, height] = viewBox;
  // The size of a CSS pixel in the view's units, for drawing markers at a fixed size.
  const px = Math.max(width, height) / VIEW_SIZE;
  const shapeClass = kind === 'fill' ? 'shape shape-fill' : 'shape shape-stroke';

  return (
    <svg
      className="morph-view"
      viewBox={`${x} ${y} ${width} ${height}`}
      width={VIEW_SIZE}
      height={VIEW_SIZE}
      role="img"
    >
      {morph.type === 'morph' ? (
        <>
          {overlays.onion &&
            morph.onionFrames.map((d, i) => <path key={i} className="onion" d={d} />)}
          {overlays.travel && <TravelLines a={morph.a} b={morph.b} />}
          <path className={shapeClass} d={toPathString(interpolate(morph.a, morph.b, t))} />
          {overlays.points && <EndPoints a={morph.a} b={morph.b} t={t} px={px} />}
        </>
      ) : (
        <>
          <path className={`${shapeClass} to-ghost`} d={to} />
          <path className={`${shapeClass} from-ghost`} d={from} />
          {overlays.points &&
            morph.subPaths.map((subPaths, i) => (
              <EndPoints key={i} a={subPaths} b={subPaths} t={0} px={px} />
            ))}
        </>
      )}
    </svg>
  );
}

/** Returns true if the paths can be drawn as a morph. */
export function canMorph(from: string, to: string) {
  return prepare(from, to).type === 'morph';
}

type Prepared =
  | {
      readonly type: 'morph';
      readonly a: SubPath[];
      readonly b: SubPath[];
      readonly onionFrames: ReadonlyArray<string>;
    }
  | {
      readonly type: 'overlay';
      /** The two paths, or none if they're written some other way (like the icons). */
      readonly subPaths: ReadonlyArray<SubPath[]>;
    };

function prepare(from: string, to: string): Prepared {
  let a: SubPath[];
  let b: SubPath[];
  try {
    a = parsePath(from);
    b = parsePath(to);
  } catch {
    // Paths written with other commands, like the icons' relative ones, are drawn as they are.
    return { type: 'overlay', subPaths: [] };
  }
  if (findMismatch(a, b)) {
    return { type: 'overlay', subPaths: [a, b] };
  }
  return {
    type: 'morph',
    a,
    b,
    onionFrames: ONION_FRAMES.map(t => toPathString(interpolate(a, b, t))),
  };
}

function TravelLines({ a, b }: { readonly a: SubPath[]; readonly b: SubPath[] }) {
  return (
    <g className="travel">
      {a.flatMap((subPath, s) =>
        subPath.map((command, c) => {
          const p = endPoint(command);
          const q = endPoint(b[s][c]);
          return <line key={`${s}-${c}`} x1={p.x} y1={p.y} x2={q.x} y2={q.y} />;
        }),
      )}
    </g>
  );
}

interface EndPointsProps {
  readonly a: SubPath[];
  readonly b: SubPath[];
  readonly t: number;
  readonly px: number;
}

function EndPoints({ a, b, t, px }: EndPointsProps) {
  const frame = interpolate(a, b, t);
  return (
    <g>
      {frame.flatMap((subPath, s) => {
        // A Z ends where its M starts, so it doesn't get a marker of its own.
        const numPoints = subPath.filter(command => command.type !== 'Z').length;
        let pointIdx = 0;
        return subPath.flatMap((command, c) => {
          if (command.type === 'Z') {
            return [];
          }
          const i = pointIdx++;
          const p = endPoint(command);
          const start = endPoint(a[s][c]);
          const end = endPoint(b[s][c]);
          const order = Math.round((i / Math.max(1, numPoints - 1)) * (NUM_ORDER_COLORS - 1));
          const title =
            `Subpath ${s + 1}, point ${i + 1} of ${numPoints}: ` +
            `(${format(start.x)}, ${format(start.y)}) to (${format(end.x)}, ${format(end.y)})`;
          return [
            <g key={`${s}-${c}`} style={{ color: `var(--order-${order})` }}>
              <title>{title}</title>
              {i === 0 && <circle className="start-ring" cx={p.x} cy={p.y} r={6 * px} />}
              <circle className="end-point" cx={p.x} cy={p.y} r={3 * px} />
              <circle className="hit-target" cx={p.x} cy={p.y} r={8 * px} />
            </g>,
          ];
        });
      })}
    </g>
  );
}

const format = (n: number) => String(Math.round(n * 100) / 100);
