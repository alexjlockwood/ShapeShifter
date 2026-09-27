import { ClipPathLayer, GroupLayer, PathLayer, VectorLayer } from 'app/modules/editor/model/layers';
import { Path } from 'app/modules/editor/model/paths';
import { describe, expect, it } from 'vitest';

import { getLayerBounds, getLayersBounds, getPathLayerBounds, hitTestLayer } from './LayerGeometry';

function path(name: string, pathData: string, props: Partial<PathLayer> = {}) {
  return new PathLayer({ name, children: [], pathData: new Path(pathData), ...props });
}

function vector(...children: Array<PathLayer | GroupLayer | ClipPathLayer>) {
  return new VectorLayer({ name: 'vector', children, width: 24, height: 24 });
}

const TOLERANCE = { tolerance: 0.5 };

describe('hitTestLayer', () => {
  // PATH-17: the fill closes open subpaths, so clicking inside should hit them.
  it('hits a fill, even of a subpath without a Z', () => {
    const open = path('open', 'M 4 4 L 20 4 L 20 20 L 4 20', { fillColor: '#000' });
    expect(hitTestLayer(vector(open), { x: 12, y: 12 }, TOLERANCE)).toBe(open);
    expect(hitTestLayer(vector(open), { x: 22, y: 12 }, TOLERANCE)).toBeUndefined();
  });

  it('uses the fill rule', () => {
    // A square with a hole, both drawn the same way around.
    const pathData = 'M 2 2 L 22 2 L 22 22 L 2 22 Z M 8 8 L 16 8 L 16 16 L 8 16 Z';
    const evenOdd = path('evenOdd', pathData, { fillColor: '#000', fillType: 'evenOdd' });
    const nonZero = path('nonZero', pathData, { fillColor: '#000', fillType: 'nonZero' });
    expect(hitTestLayer(vector(evenOdd), { x: 12, y: 12 }, TOLERANCE)).toBeUndefined();
    expect(hitTestLayer(vector(evenOdd), { x: 5, y: 12 }, TOLERANCE)).toBe(evenOdd);
    expect(hitTestLayer(vector(nonZero), { x: 12, y: 12 }, TOLERANCE)).toBe(nonZero);
  });

  it('hits strokes by their width, and outlines within the tolerance', () => {
    const line = path('line', 'M 2 12 L 22 12', { strokeColor: '#000', strokeWidth: 4 });
    expect(hitTestLayer(vector(line), { x: 12, y: 13.9 }, TOLERANCE)).toBe(line);
    expect(hitTestLayer(vector(line), { x: 12, y: 15 }, TOLERANCE)).toBeUndefined();
    const hairline = path('hairline', 'M 2 12 L 22 12');
    expect(hitTestLayer(vector(hairline), { x: 12, y: 12.4 }, TOLERANCE)).toBe(hairline);
    expect(hitTestLayer(vector(hairline), { x: 12, y: 12.6 }, TOLERANCE)).toBeUndefined();
  });

  // CANVAS-3: in a scaled group, the tolerance still means the same distance on the screen.
  it('keeps the tolerance in viewport units inside of scaled groups', () => {
    const line = path('line', 'M 20 120 L 220 120');
    const small = new GroupLayer({ name: 'small', children: [line], scaleX: 0.1, scaleY: 0.1 });
    expect(hitTestLayer(vector(small), { x: 12, y: 12.4 }, TOLERANCE)).toBe(line);
    expect(hitTestLayer(vector(small), { x: 12, y: 12.6 }, TOLERANCE)).toBeUndefined();
  });

  it('hits a fill under the pointer before a path it just misses above it', () => {
    const big = path('big', 'M 0 0 L 24 0 L 24 24 L 0 24 Z', { fillColor: '#000' });
    const dot = path('dot', 'M 11 11 L 13 11 L 13 13 L 11 13 Z', { fillColor: '#000' });
    // Within the tolerance of the dot, but inside of the big square.
    expect(hitTestLayer(vector(big, dot), { x: 13.3, y: 12 }, TOLERANCE)).toBe(big);
    // With nothing under the pointer, the near miss counts.
    expect(hitTestLayer(vector(dot), { x: 13.3, y: 12 }, TOLERANCE)).toBe(dot);
  });

  it('keeps the tolerance the same in every direction inside of a squashed group', () => {
    // 20 times narrower than it is tall, like a flip animation halfway through.
    const line = path('line', 'M 0 12 L 480 12');
    const squashed = new GroupLayer({ name: 'squashed', children: [line], scaleX: 0.05 });
    expect(hitTestLayer(vector(squashed), { x: 12, y: 12.4 }, TOLERANCE)).toBe(line);
    expect(hitTestLayer(vector(squashed), { x: 12, y: 13 }, TOLERANCE)).toBeUndefined();
  });

  it('hits the topmost layer', () => {
    const bottom = path('bottom', 'M 0 0 L 24 0 L 24 24 L 0 24 Z', { fillColor: '#000' });
    const top = path('top', 'M 8 8 L 16 8 L 16 16 L 8 16 Z', { fillColor: '#000' });
    expect(hitTestLayer(vector(bottom, top), { x: 12, y: 12 }, TOLERANCE)).toBe(top);
    expect(hitTestLayer(vector(bottom, top), { x: 2, y: 2 }, TOLERANCE)).toBe(bottom);
  });

  it('skips hidden layers, and the children of hidden groups', () => {
    const square = path('square', 'M 0 0 L 24 0 L 24 24 L 0 24 Z', { fillColor: '#000' });
    const group = new GroupLayer({ name: 'group', children: [square] });
    const hit = (hiddenLayerIds: Set<string>) =>
      hitTestLayer(vector(group), { x: 12, y: 12 }, { ...TOLERANCE, hiddenLayerIds });
    expect(hit(new Set())).toBe(square);
    expect(hit(new Set([square.id]))).toBeUndefined();
    expect(hit(new Set([group.id]))).toBeUndefined();
  });

  it('only hits a clip path by its outline', () => {
    const clip = new ClipPathLayer({
      name: 'clip',
      children: [],
      pathData: new Path('M 4 4 L 20 4 L 20 20 L 4 20 Z'),
    });
    expect(hitTestLayer(vector(clip), { x: 12, y: 12 }, TOLERANCE)).toBeUndefined();
    expect(hitTestLayer(vector(clip), { x: 12, y: 4.2 }, TOLERANCE)).toBe(clip);
  });

  it('hits a path where its own transform draws it', () => {
    // A bar along the top, turned a quarter turn clockwise around the canvas's center, so it's
    // drawn down the right side.
    const bar = path('bar', 'M 0 0 L 24 0 L 24 4 L 0 4 Z', {
      fillColor: '#000',
      rotation: 90,
      pivotX: 12,
      pivotY: 12,
    });
    expect(hitTestLayer(vector(bar), { x: 22, y: 12 }, TOLERANCE)).toBe(bar);
    expect(hitTestLayer(vector(bar), { x: 12, y: 2 }, TOLERANCE)).toBeUndefined();
    const flat = path('flat', 'M 2 12 L 22 12', { scaleY: 0 });
    expect(hitTestLayer(vector(flat), { x: 12, y: 12 }, TOLERANCE)).toBeUndefined();
  });

  it('misses everything in a group scaled to 0', () => {
    const square = path('square', 'M 0 0 L 24 0 L 24 24 L 0 24 Z', { fillColor: '#000' });
    const group = new GroupLayer({ name: 'group', children: [square], scaleX: 0 });
    expect(hitTestLayer(vector(group), { x: 12, y: 12 }, TOLERANCE)).toBeUndefined();
  });
});

describe('getLayerBounds', () => {
  it('bounds paths tightly, curves and rotated groups too', () => {
    const curve = path('curve', 'M 0 10 C 0 0 10 0 10 10');
    // The curve peaks at 2.5, halfway between its end points and control points.
    expect(getLayerBounds(vector(curve), curve.id)).toEqual({ l: 0, t: 2.5, r: 10, b: 10 });

    const bar = path('bar', 'M 0 0 L 10 0 L 10 2 L 0 2 Z');
    const rotated = new GroupLayer({ name: 'rotated', children: [bar], rotation: 90 });
    const vl = vector(rotated);
    for (const id of [bar.id, rotated.id]) {
      const { l, t, r, b } = getLayerBounds(vl, id)!;
      expect([l, t, r, b].map(n => Math.round(n * 1e6) / 1e6)).toEqual([-2, 0, 0, 10]);
    }
  });

  it('bounds transformed paths, in groups too', () => {
    const bar = path('bar', 'M 0 0 L 10 0 L 10 2 L 0 2 Z', { rotation: 90 });
    const moved = new GroupLayer({ name: 'moved', children: [bar], translateX: 5 });
    const vl = vector(moved);
    for (const id of [bar.id, moved.id]) {
      const { l, t, r, b } = getLayerBounds(vl, id)!;
      expect([l, t, r, b].map(n => Math.round(n * 1e6) / 1e6)).toEqual([3, 0, 5, 10]);
    }
    const bounds = getPathLayerBounds(vl, new Set()).get(bar.id)!;
    expect(Math.round(bounds.l * 1e6) / 1e6).toBe(3);
  });

  it('joins the bounds of several layers, and leaves out layers without paths', () => {
    const a = path('a', 'M 0 0 L 2 2');
    const b = path('b', 'M 10 10 L 12 14');
    const empty = new GroupLayer({ name: 'empty', children: [] });
    const vl = vector(a, b, empty);
    expect(getLayerBounds(vl, empty.id)).toBeUndefined();
    expect(getLayersBounds(vl, [a.id, b.id, empty.id])).toEqual({ l: 0, t: 0, r: 12, b: 14 });
  });
});
