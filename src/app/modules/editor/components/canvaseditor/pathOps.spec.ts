import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

import { GroupLayer, PathLayer, VectorLayer } from 'app/modules/editor/model/layers';
import { Path } from 'app/modules/editor/model/paths';
import { Animation, AnimationBlock } from 'app/modules/editor/model/timeline';
import init, { type PathKit } from 'pathkit-wasm/bin/pathkit.js';
import { beforeAll, describe, expect, it } from 'vitest';

import { combinePaths, getBooleanLayerIds, getOutlineLayerIds, outlineStrokes } from './pathOps';

let pk: PathKit;

beforeAll(async () => {
  const wasm = createRequire(import.meta.url).resolve('pathkit-wasm/bin/pathkit.wasm');
  pk = await init({ wasmBinary: readFileSync(wasm) });
});

function square(name: string, l: number, t: number, size: number, extra: object = {}) {
  return new PathLayer({
    name,
    children: [],
    pathData: new Path(`M ${l} ${t} H ${l + size} V ${t + size} H ${l} Z`),
    fillColor: '#000',
    ...extra,
  });
}

function document(...children: PathLayer[] | GroupLayer[]) {
  return {
    vectorLayer: new VectorLayer({ name: 'vl', width: 24, height: 24, children }),
    animation: new Animation(),
  };
}

/** The path's bounds, rounded, which don't depend on how PathKit orders the points. */
function bounds(layer: PathLayer | undefined) {
  const { l, t, r, b } = layer?.pathData?.getBoundingBox() ?? { l: 0, t: 0, r: 0, b: 0 };
  return [l, t, r, b].map(Math.round);
}

describe('combinePaths', () => {
  const a = square('a', 2, 2, 8);
  const b = square('b', 6, 6, 8);

  it('unites paths into the bottom one, and removes the others', () => {
    const doc = document(a, b);
    const result = combinePaths(pk, doc, getBooleanLayerIds(doc, [a.id, b.id]) ?? [], 'union');
    expect(result?.layerId).toBe(a.id);
    const vl = result?.document.vectorLayer;
    expect(vl?.children.map(c => c.name)).toEqual(['a']);
    expect(bounds(vl?.findLayerById(a.id) as PathLayer)).toEqual([2, 2, 14, 14]);
  });

  it('subtracts the paths above from the bottom one, and intersects them', () => {
    const doc = document(a, b);
    const subtracted = combinePaths(pk, doc, [a.id, b.id], 'subtract');
    expect(bounds(subtracted?.document.vectorLayer.findLayerById(a.id) as PathLayer)).toEqual([
      2, 2, 10, 10,
    ]);
    const intersected = combinePaths(pk, doc, [a.id, b.id], 'intersect');
    expect(bounds(intersected?.document.vectorLayer.findLayerById(a.id) as PathLayer)).toEqual([
      6, 6, 10, 10,
    ]);
    const apart = document(square('c', 0, 0, 2), square('d', 10, 10, 2));
    const [c, d] = apart.vectorLayer.children;
    expect(combinePaths(pk, apart, [c.id, d.id], 'intersect')).toBeUndefined();
  });

  it("combines paths as they appear, in the bottom one's coordinates", () => {
    // b is drawn 4 units to the right of where its path says.
    const moved = new GroupLayer({ name: 'g', children: [square('b', 2, 2, 8)], translateX: 4 });
    const doc = document(square('a', 2, 2, 8), moved as unknown as PathLayer);
    const [first, group] = doc.vectorLayer.children;
    const result = combinePaths(pk, doc, [first.id, group.children[0].id], 'union');
    expect(bounds(result?.document.vectorLayer.findLayerById(first.id) as PathLayer)).toEqual([
      2, 2, 14, 10,
    ]);
  });

  it("only combines two or more paths that aren't animated", () => {
    const doc = document(a, b);
    expect(getBooleanLayerIds(doc, [a.id])).toBeUndefined();
    expect(getBooleanLayerIds(doc, [a.id, b.id])).toEqual([a.id, b.id]);
    const animation = new Animation();
    animation.blocks = [
      AnimationBlock.from({
        layerId: b.id,
        propertyName: 'pathData',
        startTime: 0,
        endTime: 100,
        type: 'path',
        fromValue: b.pathData,
        toValue: b.pathData,
      }),
    ];
    expect(getBooleanLayerIds({ ...doc, animation }, [a.id, b.id])).toBeUndefined();
  });
});

describe('outlineStrokes', () => {
  it('turns a stroke into a filled outline, as wide as the stroke', () => {
    const line = new PathLayer({
      name: 'line',
      children: [],
      pathData: new Path('M 4 12 L 20 12'),
      strokeColor: '#f00',
      strokeWidth: 2,
    });
    const doc = document(line);
    expect(getOutlineLayerIds(doc, [line.id])).toEqual([line.id]);
    const { document: outlined, layerIds } = outlineStrokes(pk, doc, [line.id]);
    const outline = outlined.vectorLayer.findLayerById(layerIds[0]) as PathLayer;
    expect(bounds(outline)).toEqual([4, 11, 20, 13]);
    expect(outline.fillColor).toBe('#f00');
    expect(outline.strokeColor).toBe('');
  });

  it('keeps a fill, with the outline in a new path above it', () => {
    const filled = square('filled', 4, 4, 8, { strokeColor: '#f00', strokeWidth: 2 });
    const { document: outlined, layerIds } = outlineStrokes(pk, document(filled), [filled.id]);
    expect(outlined.vectorLayer.children.map(c => c.name)).toEqual(['filled', 'filled_outline']);
    expect(bounds(outlined.vectorLayer.findLayerById(layerIds[0]) as PathLayer)).toEqual([
      3, 3, 13, 13,
    ]);
  });

  it('applies the trim', () => {
    const line = new PathLayer({
      name: 'line',
      children: [],
      pathData: new Path('M 0 12 L 20 12'),
      strokeColor: '#f00',
      strokeWidth: 2,
      trimPathEnd: 0.5,
    });
    const { document: outlined } = outlineStrokes(pk, document(line), [line.id]);
    expect(bounds(outlined.vectorLayer.findLayerById(line.id) as PathLayer)).toEqual([
      0, 11, 10, 13,
    ]);
  });
});
