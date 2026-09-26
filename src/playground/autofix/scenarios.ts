import { DEMO_INFOS } from 'app/modules/editor/scripts/demos';

import { Kind } from './geometry';

export interface Scenario {
  readonly id: string;
  readonly group: string;
  readonly name: string;
  /** What a good result looks like. */
  readonly note?: string;
  readonly from: string;
  readonly to: string;
  readonly kind: Kind;
  /** The area to show, as [x, y, width, height]. Defaults to the paths' bounds. */
  readonly viewBox?: ViewBox;
}

export type ViewBox = readonly [number, number, number, number];

const ICON: ViewBox = [0, 0, 24, 24];

const format = (n: number) => String(Math.round(n * 1000) / 1000);

/** A regular polygon, drawn clockwise on screen from the given angle. */
function polygon(numSides: number, cx: number, cy: number, r: number, angle = 0) {
  const points = Array.from({ length: numSides }, (unused, i) => {
    const a = angle + (2 * Math.PI * i) / numSides;
    return `${format(cx + r * Math.cos(a))} ${format(cy + r * Math.sin(a))}`;
  });
  return `M ${points[0]} ${points
    .slice(1)
    .map(p => `L ${p}`)
    .join(' ')} Z`;
}

function star(numPoints: number, cx: number, cy: number, outer: number, inner: number) {
  const points = Array.from({ length: numPoints * 2 }, (unused, i) => {
    const a = -Math.PI / 2 + (Math.PI * i) / numPoints;
    const r = i % 2 ? inner : outer;
    return `${format(cx + r * Math.cos(a))} ${format(cy + r * Math.sin(a))}`;
  });
  return `M ${points[0]} ${points
    .slice(1)
    .map(p => `L ${p}`)
    .join(' ')} Z`;
}

/** A circle made of four cubic curves, drawn clockwise on screen unless reversed. */
function circle(cx: number, cy: number, r: number, reversed = false) {
  const k = r * 0.5523;
  const f = format;
  const clockwise = [
    `M ${f(cx)} ${f(cy - r)}`,
    `C ${f(cx + k)} ${f(cy - r)} ${f(cx + r)} ${f(cy - k)} ${f(cx + r)} ${f(cy)}`,
    `C ${f(cx + r)} ${f(cy + k)} ${f(cx + k)} ${f(cy + r)} ${f(cx)} ${f(cy + r)}`,
    `C ${f(cx - k)} ${f(cy + r)} ${f(cx - r)} ${f(cy + k)} ${f(cx - r)} ${f(cy)}`,
    `C ${f(cx - r)} ${f(cy - k)} ${f(cx - k)} ${f(cy - r)} ${f(cx)} ${f(cy - r)} Z`,
  ];
  const counterclockwise = [
    `M ${f(cx)} ${f(cy - r)}`,
    `C ${f(cx - k)} ${f(cy - r)} ${f(cx - r)} ${f(cy - k)} ${f(cx - r)} ${f(cy)}`,
    `C ${f(cx - r)} ${f(cy + k)} ${f(cx - k)} ${f(cy + r)} ${f(cx)} ${f(cy + r)}`,
    `C ${f(cx + k)} ${f(cy + r)} ${f(cx + r)} ${f(cy + k)} ${f(cx + r)} ${f(cy)}`,
    `C ${f(cx + r)} ${f(cy - k)} ${f(cx + k)} ${f(cy - r)} ${f(cx)} ${f(cy - r)} Z`,
  ];
  return (reversed ? counterclockwise : clockwise).join(' ');
}

const square = (x: number, y: number, size: number) =>
  `M ${x} ${y} L ${x + size} ${y} L ${x + size} ${y + size} L ${x} ${y + size} Z`;

/** Scales every number in an absolute path string (which has no arcs). */
const scale = (pathString: string, factor: number) =>
  pathString.replace(/-?\d+(\.\d+)?/g, n => format(Number(n) * factor));

const scaleViewBox = (viewBox: ViewBox, factor: number) =>
  viewBox.map(n => n * factor) as unknown as ViewBox;

const grid = (order: ReadonlyArray<number>, offset: number) =>
  order.map(i => square(4 + (i % 3) * 7 + offset, 4 + Math.floor(i / 3) * 7, 2)).join(' ');

const SQUARE_TO_HEPTAGON = { from: polygon(4, 12, 12, 9, 0.3), to: polygon(7, 12, 12, 9) };

const ICONS = {
  play: 'M8 5v14l11-7z',
  pause: 'M6 19h4V5H6v14zm8-14v14h4V5h-4z',
  add: 'M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z',
  remove: 'M19 13H5v-2h14v2z',
  menu: 'M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z',
  arrowBack: 'M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z',
  check: 'M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z',
  close:
    'M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z',
  favorite:
    'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z',
  star: 'M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z',
  search:
    'M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z',
};

export const BUILT_IN_SCENARIOS: ReadonlyArray<Scenario> = [
  // Basics.
  {
    id: 'same-square',
    group: 'Basics',
    name: 'The same square',
    note: 'Nothing should move.',
    from: square(6, 6, 12),
    to: square(6, 6, 12),
    kind: 'fill',
    viewBox: ICON,
  },
  {
    id: 'square-other-way',
    group: 'Basics',
    name: 'The same square, drawn the other way',
    note: 'One of them should be reversed, so that nothing moves.',
    from: 'M 6 6 L 18 6 L 18 18 L 6 18 Z',
    to: 'M 6 6 L 6 18 L 18 18 L 18 6 Z',
    kind: 'fill',
    viewBox: ICON,
  },
  {
    id: 'square-shifted',
    group: 'Basics',
    name: 'The same square, starting from another corner',
    note: 'From the auto fix spec. Nothing should move.',
    from: 'M 2 2 L 12 2 L 12 12 L 2 12 L 2 2',
    to: 'M 12 12 L 2 12 L 2 2 L 12 2 L 12 12',
    kind: 'fill',
  },
  {
    id: 'triangle-square',
    group: 'Basics',
    name: 'Triangle to square',
    note: 'One point has to be added to the triangle.',
    from: 'M 8 5 L 8 19 L 19 12 Z',
    to: square(6, 6, 12),
    kind: 'fill',
    viewBox: ICON,
  },
  {
    id: 'square-heptagon',
    group: 'Basics',
    name: 'Square to heptagon',
    note: 'Three points have to be added to the square, ideally about one per edge.',
    ...SQUARE_TO_HEPTAGON,
    kind: 'fill',
    viewBox: ICON,
  },
  {
    id: 'hexagon-triangle',
    group: 'Basics',
    name: 'Hexagon to triangle',
    note: 'Three points have to be added to the triangle.',
    from: polygon(6, 12, 12, 9),
    to: polygon(3, 12, 12, 9, Math.PI / 2),
    kind: 'fill',
    viewBox: ICON,
  },
  {
    id: 'square-circle',
    group: 'Basics',
    name: 'Square to circle',
    note: 'The lines have to be converted to curves.',
    from: square(4, 4, 16),
    to: circle(12, 12, 8),
    kind: 'fill',
    viewBox: ICON,
  },
  {
    id: 'star-circle',
    group: 'Basics',
    name: 'Star to circle',
    note: 'Six points have to be added to the circle.',
    from: star(5, 12, 12, 10, 4.5),
    to: circle(12, 12, 8),
    kind: 'fill',
    viewBox: ICON,
  },

  // Scale.
  {
    id: 'square-heptagon-small',
    group: 'Scale',
    name: 'Square to heptagon, 20 times smaller',
    note: 'Should look the same as "Square to heptagon".',
    from: scale(SQUARE_TO_HEPTAGON.from, 0.05),
    to: scale(SQUARE_TO_HEPTAGON.to, 0.05),
    kind: 'fill',
    viewBox: scaleViewBox(ICON, 0.05),
  },
  {
    id: 'square-heptagon-large',
    group: 'Scale',
    name: 'Square to heptagon, 20 times larger',
    note: 'Should look the same as "Square to heptagon".',
    from: scale(SQUARE_TO_HEPTAGON.from, 20),
    to: scale(SQUARE_TO_HEPTAGON.to, 20),
    kind: 'fill',
    viewBox: scaleViewBox(ICON, 20),
  },

  // Subpaths.
  {
    id: 'one-to-two-far-first',
    group: 'Subpaths',
    name: 'One square to two, with the far one first',
    note: 'The square should stay where it is, and a new one should grow at the bottom right.',
    from: square(3, 3, 7),
    to: `${square(14, 14, 7)} ${square(3, 3, 7)}`,
    kind: 'fill',
    viewBox: ICON,
  },
  {
    id: 'one-to-two-near-first',
    group: 'Subpaths',
    name: 'One square to two, with the near one first',
    note: "The same as the scenario above, with the target's subpaths in the other order.",
    from: square(3, 3, 7),
    to: `${square(3, 3, 7)} ${square(14, 14, 7)}`,
    kind: 'fill',
    viewBox: ICON,
  },
  {
    id: 'four-reordered',
    group: 'Subpaths',
    name: 'Four shapes in another order',
    note: 'From the auto fix spec. Nothing should move.',
    from: [
      'M 2 2 L 6 2 L 6 6 L 2 6 L 2 2',
      'M 10 3 L 20 3 L 20 5 L 10 5 L 10 3',
      'M 4 10 L 1 16 L 7 16 L 7 10 L 4 10',
      'M 20 20 L 20 15 L 18 15 L 18 20 L 20 20',
    ].join(' '),
    to: [
      'M 10 3 L 20 3 L 20 5 L 10 5 L 10 3',
      'M 4 10 L 1 16 L 7 16 L 7 10 L 4 10',
      'M 20 20 L 20 15 L 18 15 L 18 20 L 20 20',
      'M 2 2 L 6 2 L 6 6 L 2 6 L 2 2',
    ].join(' '),
    kind: 'fill',
    viewBox: [0, 0, 22, 22],
  },
  {
    id: 'nine-dots',
    group: 'Subpaths',
    name: 'Nine dots in another order',
    note: 'Each dot should move a little to the right. With more than eight subpaths, auto fix stops pairing them by position.',
    from: grid([0, 1, 2, 3, 4, 5, 6, 7, 8], 0),
    to: grid([8, 7, 6, 5, 4, 3, 2, 1, 0], 2),
    kind: 'fill',
    viewBox: ICON,
  },
  {
    id: 'ring-disc',
    group: 'Subpaths',
    name: 'Ring to disc',
    note: 'The hole has to shrink away somewhere inside the disc.',
    from: `${circle(12, 12, 10)} ${circle(12, 12, 5, true)}`,
    to: circle(12, 12, 8),
    kind: 'fill',
    viewBox: ICON,
  },
  {
    id: 'two-circles-one',
    group: 'Subpaths',
    name: 'Two circles to one',
    note: 'One circle should become the big one, and the other should shrink into it.',
    from: `${circle(6, 12, 4)} ${circle(18, 12, 4)}`,
    to: circle(12, 12, 8),
    kind: 'fill',
    viewBox: ICON,
  },

  // Open paths.
  {
    id: 'line-zigzag',
    group: 'Open paths',
    name: 'Line to zigzag',
    note: 'Three points have to be added to the line, spread out along it.',
    from: 'M 4 12 L 20 12',
    to: 'M 4 12 L 8 8 L 12 16 L 16 8 L 20 12',
    kind: 'stroke',
    viewBox: ICON,
  },
  {
    id: 'curve-line',
    group: 'Open paths',
    name: 'Curve to line',
    note: 'Both go left to right, so neither should be reversed (PATH-6 in docs/bugs/path-model.md).',
    from: 'M 4 16 Q 12 4 20 16',
    to: 'M 4 12 L 20 12',
    kind: 'stroke',
    viewBox: ICON,
  },
  {
    id: 'check-cross',
    group: 'Open paths',
    name: 'Check mark to cross',
    note: 'The check mark has one stroke and the cross has two.',
    from: 'M 5 12 L 10 17 L 19 7',
    to: 'M 6 6 L 18 18 M 18 6 L 6 18',
    kind: 'stroke',
    viewBox: ICON,
  },

  // Icons.
  ...(
    [
      ['play', 'pause', 'Play to pause'],
      ['add', 'remove', 'Add to remove'],
      ['menu', 'arrowBack', 'Menu to back arrow'],
      ['check', 'close', 'Check to close'],
      ['favorite', 'star', 'Heart to star'],
      ['search', 'close', 'Search to close'],
    ] as const
  ).map(([from, to, name]) => ({
    id: `icon-${from}-${to}`,
    group: 'Material icons',
    name,
    from: ICONS[from],
    to: ICONS[to],
    kind: 'fill' as const,
    viewBox: ICON,
  })),

  // Known crashes.
  {
    id: 'lone-point',
    group: 'Known crashes',
    name: 'A lone point to a triangle',
    note: 'PATH-9 in docs/bugs/path-model.md, the most common crash in Bugsnag (about 13,000 reports). A fix should keep the result morphable, not just skip the point.',
    from: 'M 6 5',
    to: 'M 12 6 L 13 11 Z',
    kind: 'fill',
    viewBox: ICON,
  },
  {
    id: 'arc-compact-flags',
    group: 'Known crashes',
    name: 'An arc written with compact flags, to a zigzag',
    note: "Browsers draw the arc, but Shape Shifter's parser reads it as a lone point, which is one way lone points get into projects.",
    from: 'M 4 2 a10 10 0 100 20',
    to: 'M 4 2 L 14 12 L 4 22',
    kind: 'stroke',
    viewBox: ICON,
  },
  {
    id: 'lone-point-in-target',
    group: 'Known crashes',
    name: 'An open path to two shapes with a lone point between them',
    note: 'Parsing loses the lone point, so the subpaths get out of step. This throws while adding collapsing subpaths, which also runs after every edit in action mode (about 4,000 Bugsnag reports for lone points like this).',
    from: 'M 2 19 L 20 9 L 16 16',
    to: 'M 3 11 C 6 12 2 13 11 19 Q 1 3 9 5 Z M 19 6 M 15 14 Q 8 7 2 6 Z',
    kind: 'fill',
    viewBox: ICON,
  },
  {
    id: 'lone-point-after-reversal',
    group: 'Known crashes',
    name: 'Two triangles with a lone point between them, to one shape',
    note: 'Reversing the first triangle turns its Z into an L, and then the lone point after it is lost.',
    from: 'M 0 18 L 15 4 Z M 10 16 M 12 6 L 10 24 Z',
    to: 'M 12 2 L 10 17 C 3 18 17 5 24 23 Z',
    kind: 'fill',
    viewBox: ICON,
  },
  {
    id: 'trailing-lone-point',
    group: 'Known crashes',
    name: 'A lone point before a triangle, to two shapes',
    note: 'The trailing lone M bug in docs/bugs/path-model.md.',
    from: 'M 5 5 M 0 0 L 10 0 L 10 10 Z',
    to: `M 0 0 L 10 0 L 10 10 Z ${square(12, 12, 4)}`,
    kind: 'fill',
    viewBox: [-2, -2, 20, 20],
  },

  // Performance.
  ...(
    [
      [40, 30],
      [120, 90],
      [240, 180],
    ] as const
  ).map(([from, to]) => ({
    id: `polygons-${from}-${to}`,
    group: 'Performance',
    name: `${from}-gon to ${to}-gon`,
    note: 'Auto fix tries every start point and direction, so its time grows quickly with the number of points.',
    from: polygon(from, 12, 12, 10),
    to: polygon(to, 12, 12, 7, 0.2),
    kind: 'fill' as const,
    viewBox: ICON,
  })),
];

interface DemoLayer {
  readonly id: string;
  readonly name: string;
  readonly fillColor?: string;
  readonly strokeColor?: string;
  readonly children?: ReadonlyArray<DemoLayer>;
}

interface DemoProject {
  readonly layers: {
    readonly vectorLayer: DemoLayer & { readonly width: number; readonly height: number };
  };
  readonly timeline: {
    readonly animation: {
      readonly blocks: ReadonlyArray<{
        readonly id: string;
        readonly layerId: string;
        readonly type: string;
        readonly fromValue: unknown;
        readonly toValue: unknown;
      }>;
    };
  };
}

/** Returns a scenario for each path morph in the demos in public/demos/. */
export async function loadDemoScenarios(): Promise<Scenario[]> {
  const projects = await Promise.all(
    DEMO_INFOS.map(async info => {
      const response = await fetch(`/demos/${info.id}.shapeshifter`);
      if (!response.ok) {
        throw new Error(`Couldn't load the ${info.id} demo: ${response.status}`);
      }
      return { info, project: (await response.json()) as DemoProject };
    }),
  );
  return projects.flatMap(({ info, project }) => {
    const { vectorLayer } = project.layers;
    const layers = new Map<string, DemoLayer>();
    const addLayers = (layer: DemoLayer) => {
      layers.set(layer.id, layer);
      layer.children?.forEach(addLayers);
    };
    addLayers(vectorLayer);
    return project.timeline.animation.blocks.flatMap(block => {
      const layer = layers.get(block.layerId);
      if (block.type !== 'path' || !layer) {
        return [];
      }
      const { fromValue, toValue } = block;
      if (typeof fromValue !== 'string' || typeof toValue !== 'string') {
        return [];
      }
      return [
        {
          id: `demo-${info.id}-${block.id}`,
          group: 'Demos',
          name: `${info.title}: ${layer.name}`,
          note: "Already made morphable by hand, which is what the input shows. Auto fix shouldn't make it worse.",
          from: fromValue,
          to: toValue,
          kind: layer.strokeColor && !layer.fillColor ? 'stroke' : 'fill',
          viewBox: [0, 0, vectorLayer.width, vectorLayer.height],
        } satisfies Scenario,
      ];
    });
  });
}

const CUSTOM_SCENARIOS_KEY = 'autofix-playground:custom-scenarios';

/** Returns the scenarios added on the page, which are kept across reloads. */
export function loadCustomScenarios(): Scenario[] {
  try {
    const json = localStorage.getItem(CUSTOM_SCENARIOS_KEY);
    return json ? (JSON.parse(json) as Scenario[]) : [];
  } catch {
    return [];
  }
}

export function saveCustomScenarios(scenarios: ReadonlyArray<Scenario>) {
  localStorage.setItem(CUSTOM_SCENARIOS_KEY, JSON.stringify(scenarios));
}
