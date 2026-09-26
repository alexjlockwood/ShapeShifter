import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';

import { Kind } from './geometry';
import { MorphView, Overlays, VIEW_SIZE, canMorph } from './MorphView';
import {
  BUILT_IN_SCENARIOS,
  Scenario,
  ViewBox,
  loadCustomScenarios,
  loadDemoScenarios,
  saveCustomScenarios,
} from './scenarios';
import {
  Result,
  Version,
  baseline,
  baselineInfo,
  current,
  hasProblem,
  isSameResult,
  run,
} from './versions';

interface Results {
  readonly baseline: Result | undefined;
  readonly current: Result;
}

type Filter = 'all' | 'changed' | 'problems';

interface Settings {
  readonly overlays: Overlays;
  readonly filter: Filter;
  readonly group: string;
}

const SETTINGS_KEY = 'autofix-playground:settings';

const DEFAULT_SETTINGS: Settings = {
  overlays: { points: true, travel: true, onion: false },
  filter: 'all',
  group: '',
};

function loadSettings(): Settings {
  try {
    const json = localStorage.getItem(SETTINGS_KEY);
    return json
      ? { ...DEFAULT_SETTINGS, ...(JSON.parse(json) as Partial<Settings>) }
      : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

/** How long a morph takes to play forward and back, in milliseconds. */
const CYCLE_MS = 3000;

/** Plays the morph forward and back, pausing at each end. */
function cycleTime(elapsed: number) {
  const p = (elapsed % CYCLE_MS) / CYCLE_MS;
  const forwardAndBack = p < 0.5 ? p * 2 : (1 - p) * 2;
  return Math.min(1, Math.max(0, (forwardAndBack - 0.1) / 0.8));
}

export function Playground() {
  const [demoScenarios, setDemoScenarios] = useState<ReadonlyArray<Scenario>>([]);
  const [demoError, setDemoError] = useState<string>();
  const [customScenarios, setCustomScenarios] = useState(loadCustomScenarios);
  const [settings, setSettings] = useState(loadSettings);
  const [t, setT] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [results, setResults] = useState<ReadonlyMap<string, Results>>(new Map());
  const [runCount, setRunCount] = useState(0);
  const resultsRef = useRef(new Map<string, Results>());

  useEffect(() => {
    loadDemoScenarios().then(setDemoScenarios, (e: unknown) => setDemoError(String(e)));
  }, []);

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  const scenarios = useMemo(
    () => [...customScenarios, ...BUILT_IN_SCENARIOS, ...demoScenarios],
    [customScenarios, demoScenarios],
  );

  // Runs each scenario that doesn't have results yet, one at a time, so that the page can draw
  // the results as they come in.
  useEffect(() => {
    let isCancelled = false;
    void (async () => {
      for (const scenario of scenarios) {
        const key = resultsKey(scenario);
        if (resultsRef.current.has(key)) {
          continue;
        }
        await new Promise(resolve => setTimeout(resolve));
        if (isCancelled) {
          return;
        }
        const runVersion = (version: Version) =>
          run(version, scenario.from, scenario.to, scenario.kind);
        resultsRef.current.set(key, {
          baseline: baseline && runVersion(baseline),
          current: runVersion(current),
        });
        setResults(new Map(resultsRef.current));
      }
    })();
    return () => {
      isCancelled = true;
    };
  }, [scenarios, runCount]);

  useEffect(() => {
    if (!isPlaying) {
      return undefined;
    }
    const start = performance.now();
    let frame = requestAnimationFrame(function tick(now) {
      setT(cycleTime(now - start));
      frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [isPlaying]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (event.key === ' ' && !target.closest('input, textarea, select, button')) {
        event.preventDefault();
        setIsPlaying(playing => !playing);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const runAgain = () => {
    resultsRef.current.clear();
    setResults(new Map());
    setRunCount(count => count + 1);
  };

  const updateCustomScenarios = (updated: Scenario[]) => {
    saveCustomScenarios(updated);
    setCustomScenarios(updated);
  };

  const groups = [...new Set(scenarios.map(s => s.group))];
  const visibleScenarios = scenarios.filter(scenario => {
    if (settings.group && scenario.group !== settings.group) {
      return false;
    }
    const r = results.get(resultsKey(scenario));
    switch (settings.filter) {
      case 'all':
        return true;
      case 'changed':
        return !!r?.baseline && !isSameResult(r.baseline, r.current);
      case 'problems':
        return !!r && (hasProblem(r.current) || (!!r.baseline && hasProblem(r.baseline)));
    }
    return true;
  });

  const setOverlay = (name: keyof Overlays, value: boolean) =>
    setSettings(s => ({ ...s, overlays: { ...s.overlays, [name]: value } }));

  return (
    <div className="playground">
      <header className="page-header">
        <h1>Auto fix playground</h1>
        <BaselineDescription />
        <p className="secondary">
          <strong>Current</strong> is the working tree. The page reloads when you save a change to
          the algorithm or anything it imports. Hover over a point to see where it goes.
        </p>
        {demoError && <p className="error-text">{demoError}</p>}
      </header>

      <div className="toolbar" role="toolbar">
        <button type="button" onClick={() => setIsPlaying(!isPlaying)}>
          {isPlaying ? 'Pause' : 'Play'}
        </button>
        <label className="time">
          <span>t</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.001}
            value={t}
            onChange={e => {
              setIsPlaying(false);
              setT(Number(e.target.value));
            }}
          />
          <span className="time-value">{t.toFixed(2)}</span>
        </label>
        <span className="separator" />
        <Checkbox checked={settings.overlays.points} onChange={v => setOverlay('points', v)}>
          Points
        </Checkbox>
        <Checkbox checked={settings.overlays.travel} onChange={v => setOverlay('travel', v)}>
          Travel lines
        </Checkbox>
        <Checkbox checked={settings.overlays.onion} onChange={v => setOverlay('onion', v)}>
          Onion skin
        </Checkbox>
        <span className="separator" />
        <select
          aria-label="Filter"
          value={settings.filter}
          onChange={e => setSettings(s => ({ ...s, filter: e.target.value as Filter }))}
        >
          <option value="all">All scenarios</option>
          <option value="changed">Changed from the baseline</option>
          <option value="problems">With problems</option>
        </select>
        <select
          aria-label="Group"
          value={settings.group}
          onChange={e => setSettings(s => ({ ...s, group: e.target.value }))}
        >
          <option value="">All groups</option>
          {groups.map(group => (
            <option key={group} value={group}>
              {group}
            </option>
          ))}
        </select>
        <button type="button" onClick={runAgain}>
          Run again
        </button>
      </div>

      <Summary scenarios={scenarios} results={results} />

      <CustomScenarioForm
        onAdd={scenario => updateCustomScenarios([scenario, ...customScenarios])}
      />

      <main>
        {visibleScenarios.map(scenario => (
          <ScenarioCard
            key={scenario.id}
            scenario={scenario}
            results={results.get(resultsKey(scenario))}
            t={t}
            overlays={settings.overlays}
            onRemove={
              customScenarios.includes(scenario)
                ? () => updateCustomScenarios(customScenarios.filter(s => s !== scenario))
                : undefined
            }
          />
        ))}
        {!visibleScenarios.length && <p className="secondary">No scenarios match the filters.</p>}
      </main>
    </div>
  );
}

const resultsKey = (scenario: Scenario) =>
  JSON.stringify([scenario.id, scenario.from, scenario.to, scenario.kind]);

function BaselineDescription() {
  if (!baselineInfo || !baseline) {
    return (
      <p className="notice">
        There's no baseline to compare with yet. Run <code>npm run playground:baseline</code> to
        copy the code from where this branch left <code>origin/master</code>, or{' '}
        <code>npm run playground:baseline -- &lt;ref&gt;</code> for any other commit.
      </p>
    );
  }
  return (
    <p className="secondary">
      <strong>Baseline</strong> is {baselineInfo.label} ({baselineInfo.sha.slice(0, 7)}, “
      {baselineInfo.subject}”, {baselineInfo.date}). To compare with another commit, run{' '}
      <code>npm run playground:baseline -- &lt;ref&gt;</code>.
    </p>
  );
}

function Summary(props: {
  readonly scenarios: ReadonlyArray<Scenario>;
  readonly results: ReadonlyMap<string, Results>;
}) {
  const all = props.scenarios.flatMap(s => {
    const r = props.results.get(resultsKey(s));
    return r ? [r] : [];
  });
  const ranAll = all.length === props.scenarios.length;
  const totalTime = (pick: (r: Results) => Result | undefined) =>
    all.reduce((sum, r) => {
      const result = pick(r);
      return sum + (result && result.status !== 'threw' ? result.ms : 0);
    }, 0);
  const numProblems = (pick: (r: Results) => Result | undefined) =>
    all.filter(r => {
      const result = pick(r);
      return result && hasProblem(result);
    }).length;
  const numChanged = all.filter(r => r.baseline && !isSameResult(r.baseline, r.current)).length;

  return (
    <p className="summary" aria-live="polite">
      {ranAll
        ? `Ran ${all.length} scenarios.`
        : `Running ${all.length + 1} of ${props.scenarios.length}…`}{' '}
      {baseline ? (
        <>
          <strong>{numChanged}</strong> changed from the baseline. Problems:{' '}
          <strong>{numProblems(r => r.baseline)}</strong> in the baseline,{' '}
          <strong>{numProblems(r => r.current)}</strong> now. Time:{' '}
          <strong>{formatMs(totalTime(r => r.baseline))}</strong> in the baseline,{' '}
          <strong>{formatMs(totalTime(r => r.current))}</strong> now.
        </>
      ) : (
        <>
          Problems: <strong>{numProblems(r => r.current)}</strong>. Time:{' '}
          <strong>{formatMs(totalTime(r => r.current))}</strong>.
        </>
      )}
    </p>
  );
}

function CustomScenarioForm({ onAdd }: { readonly onAdd: (scenario: Scenario) => void }) {
  const [name, setName] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [kind, setKind] = useState<Kind>('fill');
  return (
    <details className="custom-form">
      <summary>Add a scenario</summary>
      <p className="secondary">
        Paste two path strings, like the ones in an SVG's <code>d</code> attribute or a{' '}
        <code>pathData</code>. Scenarios you add are kept across reloads.
      </p>
      <form
        onSubmit={e => {
          e.preventDefault();
          onAdd({
            id: `custom-${Date.now()}`,
            group: 'Yours',
            name: name.trim() || 'Untitled',
            from: from.trim(),
            to: to.trim(),
            kind,
          });
          setName('');
          setFrom('');
          setTo('');
        }}
      >
        <label>
          Name
          <input value={name} onChange={e => setName(e.target.value)} />
        </label>
        <label>
          From
          <textarea required rows={3} value={from} onChange={e => setFrom(e.target.value)} />
        </label>
        <label>
          To
          <textarea required rows={3} value={to} onChange={e => setTo(e.target.value)} />
        </label>
        <label>
          Drawn as
          <select value={kind} onChange={e => setKind(e.target.value as Kind)}>
            <option value="fill">Fill</option>
            <option value="stroke">Stroke</option>
          </select>
        </label>
        <button type="submit">Add</button>
      </form>
    </details>
  );
}

interface ScenarioCardProps {
  readonly scenario: Scenario;
  readonly results: Results | undefined;
  readonly t: number;
  readonly overlays: Overlays;
  readonly onRemove: (() => void) | undefined;
}

function ScenarioCard({ scenario, results, t, overlays, onRemove }: ScenarioCardProps) {
  const viewBox = useMemo(
    () => scenario.viewBox ?? measureViewBox([scenario.from, scenario.to], scenario.kind),
    [scenario],
  );
  const isInputMorphable = useMemo(
    () => canMorph(scenario.from, scenario.to),
    [scenario.from, scenario.to],
  );
  const isChanged = results?.baseline && !isSameResult(results.baseline, results.current);
  const viewProps = { t, kind: scenario.kind, viewBox, overlays };

  return (
    <section className="card">
      <header className="card-header">
        <h2>{scenario.name}</h2>
        <span className="chip">{scenario.group}</span>
        {isChanged && <span className="chip chip-changed">Changed</span>}
        {results?.baseline && !isChanged && <span className="chip">Same as the baseline</span>}
        {onRemove && (
          <button type="button" className="link-button" onClick={onRemove}>
            Remove
          </button>
        )}
      </header>
      {scenario.note && <p className="note">{scenario.note}</p>}
      <div className="panels">
        <Panel title="Input">
          <MorphView from={scenario.from} to={scenario.to} {...viewProps} />
          <p className="caption">
            {isInputMorphable ? 'Already morphable as it is.' : 'Dashed: from. Solid: to.'}
          </p>
        </Panel>
        {baseline && (
          <Panel title="Baseline">
            <ResultView result={results?.baseline} viewProps={viewProps} />
          </Panel>
        )}
        <Panel title="Current">
          <ResultView
            result={results?.current}
            compareTo={results?.baseline}
            viewProps={viewProps}
          />
        </Panel>
      </div>
    </section>
  );
}

function Panel({ title, children }: { readonly title: string; readonly children: ReactNode }) {
  return (
    <div className="panel">
      <h3>{title}</h3>
      {children}
    </div>
  );
}

interface ResultViewProps {
  readonly result: Result | undefined;
  readonly compareTo?: Result;
  readonly viewProps: {
    readonly t: number;
    readonly kind: Kind;
    readonly viewBox: ViewBox;
    readonly overlays: Overlays;
  };
}

function ResultView({ result, compareTo, viewProps }: ResultViewProps) {
  if (!result) {
    return (
      <div className="placeholder" style={{ width: VIEW_SIZE, height: VIEW_SIZE }}>
        Running…
      </div>
    );
  }
  if (result.status === 'threw') {
    return (
      <>
        <div className="placeholder error-box" style={{ width: VIEW_SIZE, height: VIEW_SIZE }}>
          <code>{result.error}</code>
        </div>
        <StatusBadge result={result} />
      </>
    );
  }
  const base = compareTo && compareTo.status !== 'threw' ? compareTo : undefined;
  const metrics = result.metrics;
  const baseMetrics = base?.metrics;
  return (
    <>
      <MorphView from={result.from} to={result.to} {...viewProps} />
      <StatusBadge result={result} />
      <dl className="metrics">
        <Metric label="Time">
          {formatMs(result.ms)}
          {base && <TimeDelta ms={result.ms} baseMs={base.ms} />}
        </Metric>
        <Metric label="Points added">
          +{result.added[0]} from, +{result.added[1]} to
        </Metric>
        {metrics && (
          <>
            <Metric label="Mean travel">
              {formatPercent(metrics.meanTravel)}
              <Delta value={metrics.meanTravel} base={baseMetrics?.meanTravel} better="lower" />
            </Metric>
            <Metric label="Max travel">
              {formatPercent(metrics.maxTravel)}
              <Delta value={metrics.maxTravel} base={baseMetrics?.maxTravel} better="lower" />
            </Metric>
            {metrics.worstArea !== undefined && (
              <Metric label="Smallest area">
                {formatPercent(metrics.worstArea)}
                <Delta value={metrics.worstArea} base={baseMetrics?.worstArea} better="higher" />
              </Metric>
            )}
          </>
        )}
      </dl>
    </>
  );
}

function StatusBadge({ result }: { readonly result: Result }) {
  if (result.status === 'threw') {
    return <p className="status status-critical">✕ Threw an error</p>;
  }
  if (result.status === 'unmorphable') {
    return <p className="status status-critical">✕ Not morphable: {result.mismatch}</p>;
  }
  const numOpposite = result.metrics?.oppositeWindings ?? 0;
  if (numOpposite) {
    return (
      <p className="status status-warning">
        ⚠ {numOpposite === 1 ? '1 subpath turns' : `${numOpposite} subpaths turn`} inside out
      </p>
    );
  }
  return <p className="status status-good">✓ Morphable</p>;
}

function Metric({ label, children }: { readonly label: string; readonly children: ReactNode }) {
  return (
    <div className="metric">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

interface DeltaProps {
  readonly value: number;
  readonly base: number | undefined;
  readonly better: 'lower' | 'higher';
}

/** Shows how a metric changed from the baseline, in percentage points. */
function Delta({ value, base, better }: DeltaProps) {
  if (base === undefined || Math.abs(value - base) < 0.001) {
    return null;
  }
  const isBetter = better === 'lower' ? value < base : value > base;
  return (
    <span className={isBetter ? 'delta delta-good' : 'delta delta-bad'}>
      {value > base ? '▲' : '▼'} {(Math.abs(value - base) * 100).toFixed(1)} pts
    </span>
  );
}

/** Shows how the time changed from the baseline, ignoring small changes, which are noise. */
function TimeDelta({ ms, baseMs }: { readonly ms: number; readonly baseMs: number }) {
  const change = (ms - baseMs) / baseMs;
  if (Math.abs(ms - baseMs) < 0.5 || Math.abs(change) < 0.2) {
    return null;
  }
  return (
    <span className={change < 0 ? 'delta delta-good' : 'delta delta-bad'}>
      {change > 0 ? '▲' : '▼'} {Math.round(Math.abs(change) * 100)}%
    </span>
  );
}

function Checkbox(props: {
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
  readonly children: ReactNode;
}) {
  return (
    <label className="checkbox">
      <input
        type="checkbox"
        checked={props.checked}
        onChange={e => props.onChange(e.target.checked)}
      />
      {props.children}
    </label>
  );
}

const formatMs = (ms: number) => (ms < 10 ? `${ms.toFixed(1)} ms` : `${Math.round(ms)} ms`);

const formatPercent = (fraction: number) => `${(fraction * 100).toFixed(1)}%`;

let measuringPath: SVGPathElement | undefined;

/** Returns a square area around the paths, with some room around them. */
function measureViewBox(pathStrings: ReadonlyArray<string>, kind: Kind): ViewBox {
  if (!measuringPath) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('aria-hidden', 'true');
    svg.style.position = 'absolute';
    svg.style.visibility = 'hidden';
    measuringPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    svg.appendChild(measuringPath);
    document.body.appendChild(svg);
  }
  const path = measuringPath;
  const boxes = pathStrings.map(d => {
    path.setAttribute('d', d);
    return path.getBBox();
  });
  const left = Math.min(...boxes.map(b => b.x));
  const top = Math.min(...boxes.map(b => b.y));
  const right = Math.max(...boxes.map(b => b.x + b.width));
  const bottom = Math.max(...boxes.map(b => b.y + b.height));
  const size = Math.max(right - left, bottom - top, 1e-6) * (kind === 'stroke' ? 1.3 : 1.2);
  const cx = (left + right) / 2;
  const cy = (top + bottom) / 2;
  return [cx - size / 2, cy - size / 2, size, size];
}
