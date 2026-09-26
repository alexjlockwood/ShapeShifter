import * as currentPaths from 'app/modules/editor/model/paths';
import * as currentAlgorithms from 'app/modules/editor/scripts/algorithms';

import { Kind, Metrics, findMismatch, measure, parsePath } from './geometry';

type PathsModule = typeof currentPaths;
type AlgorithmsModule = typeof currentAlgorithms;

/** Describes the commit that scripts/playground-baseline.mjs copied. */
export interface BaselineInfo {
  readonly label: string;
  readonly sha: string;
  readonly subject: string;
  readonly date: string;
}

export interface Version {
  readonly name: string;
  /** Runs auto fix, and returns the new paths and how long auto fix took. */
  autoFix(from: string, to: string): FixOutput;
}

interface FixOutput {
  readonly from: string;
  readonly to: string;
  readonly numInputCommands: readonly [number, number];
  readonly ms: number;
}

function createVersion(name: string, paths: PathsModule, algorithms: AlgorithmsModule): Version {
  return {
    name,
    autoFix(from, to) {
      const fromPath = new paths.Path(from);
      const toPath = new paths.Path(to);
      const start = performance.now();
      const [fixedFrom, fixedTo] = algorithms.AutoAwesome.autoFix(fromPath, toPath);
      const ms = performance.now() - start;
      return {
        from: fixedFrom.getPathString(),
        to: fixedTo.getPathString(),
        numInputCommands: [fromPath.getCommands().length, toPath.getCommands().length],
        ms,
      };
    },
  };
}

export const current = createVersion('Current', currentPaths, currentAlgorithms);

// The globs match nothing until scripts/playground-baseline.mjs has made the copy.
const baselinePaths = import.meta.glob<PathsModule>(
  '/.playground-baseline/src/app/modules/editor/model/paths/index.ts',
  { eager: true },
);
const baselineAlgorithms = import.meta.glob<AlgorithmsModule>(
  '/.playground-baseline/src/app/modules/editor/scripts/algorithms/index.ts',
  { eager: true },
);
const baselineInfos = import.meta.glob<BaselineInfo>('/.playground-baseline/baseline.json', {
  eager: true,
  import: 'default',
});

export const baselineInfo: BaselineInfo | undefined = Object.values(baselineInfos)[0];

const baselinePathsModule = Object.values(baselinePaths)[0];
const baselineAlgorithmsModule = Object.values(baselineAlgorithms)[0];
export const baseline: Version | undefined =
  baselineInfo && baselinePathsModule && baselineAlgorithmsModule
    ? createVersion('Baseline', baselinePathsModule, baselineAlgorithmsModule)
    : undefined;

export type Result =
  | {
      readonly status: 'morphable' | 'unmorphable';
      readonly from: string;
      readonly to: string;
      /** How many commands auto fix added to each path. */
      readonly added: readonly [number, number];
      /** Why the paths can't be morphed, if they can't. */
      readonly mismatch: string | undefined;
      readonly metrics: Metrics | undefined;
      readonly ms: number;
    }
  | { readonly status: 'threw'; readonly error: string };

/**
 * Runs auto fix on a scenario. Quick runs are repeated a few times and the median time is kept,
 * since a single run of a few milliseconds is mostly noise.
 */
export function run(version: Version, from: string, to: string, kind: Kind): Result {
  let output: FixOutput;
  const times: number[] = [];
  try {
    output = version.autoFix(from, to);
    times.push(output.ms);
    while (times.length < 7 && times.reduce((sum, ms) => sum + ms, 0) < 100) {
      times.push(version.autoFix(from, to).ms);
    }
  } catch (e) {
    return { status: 'threw', error: e instanceof Error ? e.message : String(e) };
  }
  times.sort((a, b) => a - b);
  const ms = times[Math.floor(times.length / 2)];

  const a = parsePath(output.from);
  const b = parsePath(output.to);
  const mismatch = findMismatch(a, b);
  return {
    status: mismatch ? 'unmorphable' : 'morphable',
    from: output.from,
    to: output.to,
    added: [
      a.flat().length - output.numInputCommands[0],
      b.flat().length - output.numInputCommands[1],
    ],
    mismatch,
    metrics: mismatch ? undefined : measure(a, b, kind),
    ms,
  };
}

/** Returns true if something's clearly wrong with a result. */
export const hasProblem = (result: Result) =>
  result.status !== 'morphable' || (result.metrics?.oppositeWindings ?? 0) > 0;

export function isSameResult(a: Result, b: Result) {
  if (a.status === 'threw' || b.status === 'threw') {
    return a.status === 'threw' && b.status === 'threw' && a.error === b.error;
  }
  return a.from === b.from && a.to === b.to;
}

// Results computed with the old code would be stale after a change to the algorithm (or anything
// it imports, including the baseline copy), so reload the page to run everything again.
if (import.meta.hot) {
  import.meta.hot.accept(() => window.location.reload());
}
