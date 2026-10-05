import {
  ClipPathLayer,
  GroupLayer,
  Layer,
  PathLayer,
  VectorLayer,
} from 'app/modules/editor/model/layers';
import { Path } from 'app/modules/editor/model/paths';
import { Animation, AnimationBlock } from 'app/modules/editor/model/timeline';
import { describe, expect, it } from 'vitest';

import {
  breakApartLayers,
  combineLayers,
  getBrokenApartLayerIds,
  getCombinedLayerIds,
} from './combineLayers';

function ellipse(name: string, cx: number, cy: number, r: number, extra: object = {}) {
  return new PathLayer({
    name,
    children: [],
    pathData: new Path(
      `M ${cx - r} ${cy} A ${r} ${r} 0 1 0 ${cx + r} ${cy} A ${r} ${r} 0 1 0 ${cx - r} ${cy} Z`,
    ),
    fillColor: '#ff0000',
    ...extra,
  });
}

function document(children: Layer[], blocks: AnimationBlock[] = []) {
  const animation = new Animation();
  animation.blocks = blocks;
  return {
    vectorLayer: new VectorLayer({ name: 'vl', width: 24, height: 24, children }),
    animation,
  };
}

function block(layerId: string, propertyName: string, fromValue: unknown, toValue: unknown) {
  const type =
    propertyName === 'pathData' ? 'path' : propertyName.endsWith('Color') ? 'color' : 'number';
  return AnimationBlock.from({
    layerId,
    propertyName,
    startTime: 0,
    endTime: 100,
    type,
    fromValue,
    toValue,
  });
}

/** The path's bounds, rounded, since arcs become curves that can overshoot a little. */
function bounds(path: Path | undefined) {
  const { l, t, r, b } = path?.getBoundingBox() ?? { l: 0, t: 0, r: 0, b: 0 };
  return [l, t, r, b].map(n => Math.round(n));
}

describe('combineLayers', () => {
  it('combines two ellipses into one even-odd path, a donut', () => {
    const outer = ellipse('outer', 12, 12, 10);
    const inner = ellipse('inner', 12, 12, 5, { fillColor: '#00ff00' });
    const doc = document([outer, inner]);
    const result = combineLayers(doc, [inner.id, outer.id]);
    if (!('layerId' in result)) {
      throw new Error(result.reason);
    }
    expect(result.layerId).toBe(outer.id);
    const { vectorLayer } = result.document;
    expect(vectorLayer.children.map(l => l.name)).toEqual(['outer']);
    const combined = vectorLayer.children[0] as PathLayer;
    // The bottom path keeps its style, with an even-odd fill so the inner one is a hole.
    expect(combined.fillColor).toBe('#ff0000');
    expect(combined.fillType).toBe('evenOdd');
    const subPaths = combined.pathData?.getSubPaths() ?? [];
    expect(subPaths).toHaveLength(2);
    expect(bounds(combined.pathData)).toEqual([2, 2, 22, 22]);
    // The original layers are left alone.
    expect(outer.fillType).toBe('nonZero');
    expect(result.document.animation).toBe(doc.animation);
  });

  it("maps every path into the bottom one's coordinates", () => {
    const bottom = ellipse('bottom', 4, 4, 2);
    const moved = ellipse('moved', 4, 4, 2);
    const group = new GroupLayer({ name: 'g', children: [moved], translateX: 10, scaleY: 2 });
    const shifted = new GroupLayer({ name: 'h', children: [bottom], translateY: 5 });
    const doc = document([shifted, group]);
    const result = combineLayers(doc, [bottom.id, moved.id]);
    if (!('layerId' in result)) {
      throw new Error(result.reason);
    }
    const combined = result.document.vectorLayer.findLayerById(bottom.id) as PathLayer;
    // The moved ellipse is drawn at x 12 to 16 and y 4 to 12, which is 5 higher in h.
    expect(combined.pathData?.getSubPaths()).toHaveLength(2);
    const second = new Path(combined.pathData?.getPathString().split(/(?=M)/)[1] ?? '');
    expect(bounds(second)).toEqual([12, -1, 16, 7]);
    expect(result.document.vectorLayer.findLayerById(group.id)?.children).toEqual([]);
  });

  it('refuses rather than dropping what it would lose', () => {
    const a = ellipse('a', 6, 6, 4);
    const b = ellipse('b', 16, 16, 4);
    const reason = (doc: ReturnType<typeof document>, ids = [a.id, b.id]) =>
      getCombinedLayerIds(doc, ids)?.reason;

    expect(getCombinedLayerIds(document([a, b]), [a.id])).toBeUndefined();
    expect(getCombinedLayerIds(document([a, b]), [a.id, b.id])).toEqual({ layerIds: [a.id, b.id] });

    const mask = new ClipPathLayer({
      name: 'mask',
      children: [],
      pathData: new Path('M 0 0 L 1 1'),
    });
    expect(reason(document([a, mask]), [a.id, mask.id])).toBe('Only paths can be combined');
    const group = new GroupLayer({ name: 'g', children: [b] });
    expect(reason(document([a, group]), [a.id, group.id])).toBe('Only paths can be combined');

    const empty = new PathLayer({ name: 'empty', children: [], pathData: undefined });
    expect(reason(document([a, empty]), [a.id, empty.id])).toBe('empty has no path');

    const morph = block(a.id, 'pathData', a.pathData, a.pathData);
    expect(reason(document([a, b], [morph]))).toBe("a's path is animated");

    // The bottom path keeps its animations, but the others' would be lost.
    const bottomColor = block(a.id, 'fillColor', '#000000', '#ffffff');
    expect(reason(document([a, b], [bottomColor]))).toBeUndefined();
    const otherColor = block(b.id, 'fillColor', '#000000', '#ffffff');
    expect(reason(document([a, b], [otherColor]))).toBe("b's animations would be lost");

    const trimmed = ellipse('trimmed', 16, 16, 4, { trimPathEnd: 0.5 });
    expect(reason(document([a, trimmed]), [a.id, trimmed.id])).toBe('trimmed is trimmed');
    const trim = block(a.id, 'trimPathEnd', 0, 1);
    expect(reason(document([a, b], [trim]))).toBe('a is trimmed');
  });

  it("refuses paths in animated groups that the others aren't in", () => {
    const a = ellipse('a', 6, 6, 4);
    const b = ellipse('b', 16, 16, 4);
    const spinning = new GroupLayer({ name: 'spinning', children: [b] });
    const rotation = block(spinning.id, 'rotation', 0, 90);
    expect(getCombinedLayerIds(document([a, spinning], [rotation]), [a.id, b.id])?.reason).toBe(
      "spinning's transform is animated",
    );
    // With the bottom path in the group, the other one would start turning with it.
    const c = ellipse('c', 6, 6, 4);
    const d = ellipse('d', 16, 16, 4);
    const turning = new GroupLayer({ name: 'turning', children: [c] });
    const turn = block(turning.id, 'rotation', 0, 90);
    expect(getCombinedLayerIds(document([turning, d], [turn]), [c.id, d.id])?.reason).toBe(
      "turning's transform is animated",
    );
    // Both paths turn with the group, and so does the combined one.
    const both = new GroupLayer({ name: 'both', children: [a, b] });
    const spin = block(both.id, 'rotation', 0, 90);
    const doc = document([both], [spin]);
    expect(getCombinedLayerIds(doc, [a.id, b.id])).toEqual({ layerIds: [a.id, b.id] });
    const result = combineLayers(doc, [a.id, b.id]);
    expect('layerId' in result && result.document.animation.blocks).toEqual([spin]);
  });
});

describe('breakApartLayers', () => {
  const twoSquares = () =>
    new PathLayer({
      name: 'squares',
      children: [],
      pathData: new Path('M 0 0 L 4 0 L 4 4 Z M 10 10 L 14 10 L 14 14 Z'),
      fillColor: '#000000',
      fillType: 'evenOdd',
    });

  it('makes a path for each subpath, with unique names, ids, and copied blocks', () => {
    const squares = twoSquares();
    const other = new PathLayer({ name: 'squares_1', children: [], pathData: new Path('M 0 0') });
    const color = block(squares.id, 'fillColor', '#000000', '#ffffff');
    const doc = document([squares, other], [color]);
    const result = breakApartLayers(doc, [squares.id], new Set([squares.id]));
    if (!('layerIds' in result)) {
      throw new Error(result.reason);
    }
    const { vectorLayer, animation } = result.document;
    expect(vectorLayer.children.map(l => l.name)).toEqual(['squares', 'squares_2', 'squares_1']);
    const [first, second] = vectorLayer.children as PathLayer[];
    expect(result.layerIds).toEqual([squares.id, second.id]);
    expect(first.id).toBe(squares.id);
    expect(second.id).not.toBe(squares.id);
    expect(first.pathData?.getPathString()).toBe('M 0 0 L 4 0 L 4 4 Z');
    expect(second.pathData?.getPathString()).toBe('M 10 10 L 14 10 L 14 14 Z');
    expect(second.fillType).toBe('evenOdd');
    // The first piece keeps the block, and the second gets a copy with a new id.
    expect(animation.blocks).toHaveLength(2);
    expect(animation.blocks[0]).toEqual(color);
    const copy = animation.blocks[1];
    expect(copy.layerId).toBe(second.id);
    expect(copy.id).not.toBe(color.id);
    expect(copy.toValue).toBe('#ffffff');
    // The path was hidden, so the new piece is too.
    expect(result.hiddenLayerIds).toEqual(new Set([squares.id, second.id]));
  });

  it('only splits paths with more than one subpath, and refuses animated or trimmed ones', () => {
    const squares = twoSquares();
    const single = new PathLayer({
      name: 'single',
      children: [],
      pathData: new Path('M 0 0 L 1 1'),
    });
    expect(getBrokenApartLayerIds(document([single]), [single.id])).toBeUndefined();
    expect(getBrokenApartLayerIds(document([squares, single]), [squares.id, single.id])).toEqual({
      layerIds: [squares.id],
    });
    const morph = block(squares.id, 'pathData', squares.pathData, squares.pathData);
    expect(getBrokenApartLayerIds(document([squares], [morph]), [squares.id])?.reason).toBe(
      "squares's path is animated",
    );
    const trimmed = twoSquares();
    trimmed.trimPathStart = 0.25;
    expect(getBrokenApartLayerIds(document([trimmed]), [trimmed.id])?.reason).toBe(
      'squares is trimmed',
    );
    expect(breakApartLayers(document([single]), [single.id])).toEqual({
      reason: 'Select a path with more than one subpath',
    });
  });

  it('keeps each hole with the shape it cuts', () => {
    const pieces = (layer: PathLayer) => {
      const result = breakApartLayers(document([layer]), [layer.id]);
      if (!('layerIds' in result)) {
        throw new Error(result.reason);
      }
      return (result.document.vectorLayer.children as PathLayer[]).map(
        l => l.pathData?.getSubPaths().length,
      );
    };
    // Material's outlined bell: the clapper, and the bell with the hole that outlines it.
    const bell = new PathLayer({
      name: 'bell',
      children: [],
      pathData: new Path(
        'M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2zm-2 1H8v-6c0-2.48 1.51-4.5 4-4.5s4 2.02 4 4.5v6z',
      ),
      fillColor: '#000000',
    });
    expect(pieces(bell)).toEqual([1, 2]);

    // A square with a square hole, and a dot inside the hole, which is a shape of its own.
    const outer = 'M 0 0 L 10 0 L 10 10 L 0 10 Z';
    const dot = 'M 4 4 L 6 4 L 6 6 L 4 6 Z';
    const ring = (hole: string, fillType: 'nonZero' | 'evenOdd', fillColor = '#000000') =>
      new PathLayer({
        name: 'ring',
        children: [],
        pathData: new Path(`${outer} ${hole} ${dot}`),
        fillColor,
        strokeColor: '#000000',
        fillType,
      });
    expect(pieces(ring('M 2 2 L 2 8 L 8 8 L 8 2 Z', 'nonZero'))).toEqual([2, 1]);
    // With even-odd, a hole can run either way.
    expect(pieces(ring('M 2 2 L 8 2 L 8 8 L 2 8 Z', 'evenOdd'))).toEqual([2, 1]);
    // With nonzero, a square running the same way as the outer one fills, so it's no hole.
    expect(pieces(ring('M 2 2 L 8 2 L 8 8 L 2 8 Z', 'nonZero'))).toEqual([1, 1, 1]);
    // Without a fill, there are no holes, just outlines.
    expect(pieces(ring('M 2 2 L 2 8 L 8 8 L 8 2 Z', 'nonZero', ''))).toEqual([1, 1, 1]);

    // One shape with a hole, like a donut made with Combine, splits into every subpath, since
    // there's nothing else to split.
    const donut = new PathLayer({
      name: 'donut',
      children: [],
      pathData: new Path(`${outer} M 2 2 L 2 8 L 8 8 L 8 2 Z`),
      fillColor: '#000000',
    });
    expect(pieces(donut)).toEqual([1, 1]);
  });

  it('pivots each piece at its own center, unless the path uses its transform', () => {
    const pivots = (doc: ReturnType<typeof document>, id: string) => {
      const result = breakApartLayers(doc, [id]);
      if (!('layerIds' in result)) {
        throw new Error(result.reason);
      }
      return (result.document.vectorLayer.children as PathLayer[]).map(l => [l.pivotX, l.pivotY]);
    };
    const squares = twoSquares();
    expect(pivots(document([squares]), squares.id)).toEqual([
      [2, 2],
      [12, 12],
    ]);

    // Moving the pivot of a rotated path, or of one with a rotation block, would move its pieces.
    const rotated = twoSquares();
    rotated.rotation = 90;
    rotated.pivotX = 5;
    expect(pivots(document([rotated]), rotated.id)).toEqual([
      [5, 0],
      [5, 0],
    ]);
    const spun = twoSquares();
    expect(pivots(document([spun], [block(spun.id, 'rotation', 0, 90)]), spun.id)).toEqual([
      [0, 0],
      [0, 0],
    ]);
  });

  it('splits a path inside of a group', () => {
    const squares = twoSquares();
    const group = new GroupLayer({ name: 'g', children: [squares] });
    const result = breakApartLayers(document([group]), [squares.id]);
    expect('layerIds' in result && result.document.vectorLayer.children[0].children).toHaveLength(
      2,
    );
  });
});
