import {
  ClipPathLayer,
  GroupLayer,
  Layer,
  PathLayer,
  VectorLayer,
} from 'app/modules/editor/model/layers';
import { Path } from 'app/modules/editor/model/paths';
import { Animation, AnimationBlock, PathAnimationBlock } from 'app/modules/editor/model/timeline';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  getImportMorphOffer,
  getMorphFromRefusal,
  getMorphRefusal,
  getMorphTargets,
  MORPH_DURATION,
  morphIntoLayer,
  morphLayerSets,
} from './morphLayers';
import type { LayerDocument } from './pathOpLayers';

const SQUARE = 'M 2 2 L 10 2 L 10 10 L 2 10 Z';
const TRIANGLE = 'M 14 14 L 22 14 L 18 22 Z';

function path(name: string, pathData: string, extra: object = {}) {
  return new PathLayer({
    name,
    children: [],
    pathData: new Path(pathData),
    fillColor: '#ff0000',
    ...extra,
  });
}

function document(children: Layer[], blocks: AnimationBlock[] = [], duration = 1000) {
  const animation = new Animation({ duration });
  animation.blocks = blocks;
  return {
    vectorLayer: new VectorLayer({ name: 'vl', width: 24, height: 24, children }),
    animation,
  };
}

function block(
  layerId: string,
  propertyName: string,
  fromValue: unknown,
  toValue: unknown,
  startTime = 0,
  endTime = 100,
) {
  const type =
    propertyName === 'pathData' ? 'path' : propertyName.endsWith('Color') ? 'color' : 'number';
  return AnimationBlock.from({
    layerId,
    propertyName,
    startTime,
    endTime,
    type,
    fromValue,
    toValue,
  });
}

function morph(doc: LayerDocument, fromId: string, toId: string, currentTime = 0) {
  const morphed = morphIntoLayer(doc, fromId, toId, currentTime);
  if ('reason' in morphed) {
    throw new Error(morphed.reason);
  }
  const blocks = morphed.document.animation.blocks.filter(b => b.layerId === fromId);
  const pathBlock = blocks.find(b => b.id === morphed.blockId) as PathAnimationBlock;
  return { ...morphed, blocks, pathBlock };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('morphIntoLayer', () => {
  it('adds a morphing path block, deletes the other path, and auto fixes the morph', () => {
    const a = path('a', SQUARE);
    const b = path('b', TRIANGLE);
    const { document: result, pathBlock, blocks } = morph(document([a, b]), a.id, b.id);
    expect(result.vectorLayer.children.map(l => l.name)).toEqual(['a']);
    // The same colors don't get blocks.
    expect(blocks).toEqual([pathBlock]);
    expect(pathBlock).toMatchObject({ startTime: 0, endTime: MORPH_DURATION });
    expect(pathBlock.isAnimatable()).toBe(true);
    // Auto fix only adds points, so the ends are where they were.
    expect(pathBlock.fromValue?.getBoundingBox()).toMatchObject({ l: 2, t: 2, r: 10, b: 10 });
    expect(pathBlock.toValue?.getBoundingBox()).toMatchObject({ l: 14, t: 14, r: 22, b: 22 });
    // The path's own path stays linked to the start of the morph.
    const morphed = result.vectorLayer.findLayerById(a.id) as PathLayer;
    expect(morphed.pathData?.getPathString()).toBe(pathBlock.fromValue?.getPathString());
  });

  it('keeps the morph as it is, with the error, when auto fix fails', () => {
    const a = path('a', SQUARE);
    const b = path('b', TRIANGLE);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(Path.prototype, 'mutate').mockImplementationOnce(() => {
      throw new Error('Auto fix failed');
    });
    const { pathBlock, autoFixError, document: result } = morph(document([a, b]), a.id, b.id);
    expect(autoFixError).toEqual(new Error('Auto fix failed'));
    expect(pathBlock.fromValue?.getPathString()).toBe(new Path(SQUARE).getPathString());
    expect(pathBlock.toValue?.getPathString()).toBe(new Path(TRIANGLE).getPathString());
    expect(result.vectorLayer.children.map(l => l.name)).toEqual(['a']);
  });

  it("maps the other path into the path's coordinates, and scales its stroke with it", () => {
    const a = path('a', SQUARE, { strokeColor: '#000000', strokeWidth: 1 });
    const b = path('b', 'M 0 0 L 4 0 L 4 4 L 0 4 Z', { strokeColor: '#000000', strokeWidth: 1 });
    const groupA = new GroupLayer({ name: 'groupA', children: [a], translateX: 5 });
    const groupB = new GroupLayer({ name: 'groupB', children: [b], scaleX: 2, scaleY: 2 });
    const { pathBlock, blocks } = morph(document([groupA, groupB]), a.id, b.id);
    // B is drawn at (0, 0) to (8, 8), which is (-5, 0) to (3, 8) in A's group.
    expect(pathBlock.toValue?.getBoundingBox()).toMatchObject({ l: -5, t: 0, r: 3, b: 8 });
    expect(blocks.find(b => b.propertyName === 'strokeWidth')).toMatchObject({
      fromValue: 1,
      toValue: 2,
    });
  });

  it("maps through the paths' own transforms, like their groups'", () => {
    const a = path('a', SQUARE, { translateX: 5 });
    const b = path('b', 'M 0 0 L 4 0 L 4 4 L 0 4 Z', { scaleX: 2, scaleY: 2 });
    const { pathBlock } = morph(document([a, b]), a.id, b.id);
    expect(pathBlock.toValue?.getBoundingBox()).toMatchObject({ l: -5, t: 0, r: 3, b: 8 });
  });

  it("starts from the path as it is at the block's start, after its last path block", () => {
    const a = path('a', SQUARE);
    const b = path('b', TRIANGLE);
    const earlier = block(a.id, 'pathData', new Path(SQUARE), new Path('M 3 3 L 9 3 L 9 9 Z'));
    earlier.startTime = 100;
    earlier.endTime = 400;
    // The current time is in the earlier block, so the morph goes right after it.
    const { pathBlock } = morph(document([a, b], [earlier]), a.id, b.id, 200);
    expect(pathBlock).toMatchObject({ startTime: 400, endTime: 400 + MORPH_DURATION });
    // Auto fix keeps both paths' shapes.
    expect(pathBlock.fromValue?.getBoundingBox()).toMatchObject({ l: 3, t: 3, r: 9, b: 9 });
    expect(pathBlock.isAnimatable()).toBe(true);
  });

  it('goes at the current time if there is room, or as late as there is', () => {
    const a = path('a', SQUARE);
    const b = path('b', TRIANGLE);
    expect(morph(document([a, b]), a.id, b.id, 200).pathBlock.startTime).toBe(200);
    expect(morph(document([a, b]), a.id, b.id, 900).pathBlock.startTime).toBe(700);
  });

  it("says so when there's no room for the morph", () => {
    const a = path('a', SQUARE);
    const b = path('b', TRIANGLE);
    const filling = block(a.id, 'pathData', new Path(SQUARE), new Path(SQUARE), 0, 1000);
    expect(getMorphRefusal(document([a, b], [filling]), a.id, b.id, 0)).toBe(
      "There's no room for a 300 ms morph in a's timeline",
    );
    // Nor in an animation that's too short.
    expect(getMorphRefusal(document([a, b], [], 200), a.id, b.id, 0)).toBe(
      "There's no room for a 300 ms morph in a's timeline",
    );
  });

  it('animates the fill and stroke only where they differ, in the same time range', () => {
    const a = path('a', SQUARE, { fillColor: '#ff0000', fillAlpha: 1, strokeWidth: 0 });
    const b = path('b', TRIANGLE, {
      fillColor: '#0000ff',
      fillAlpha: 0.5,
      strokeColor: '#00ff00',
      strokeWidth: 3,
    });
    const { blocks } = morph(document([a, b]), a.id, b.id, 100);
    expect(
      blocks.map(({ propertyName, fromValue, toValue, startTime, endTime }) => ({
        propertyName,
        startTime,
        endTime,
        ...(propertyName === 'pathData' ? {} : { fromValue, toValue }),
      })),
    ).toEqual([
      { propertyName: 'pathData', startTime: 100, endTime: 400 },
      {
        propertyName: 'fillColor',
        startTime: 100,
        endTime: 400,
        fromValue: '#ff0000',
        toValue: '#0000ff',
      },
      { propertyName: 'fillAlpha', startTime: 100, endTime: 400, fromValue: 1, toValue: 0.5 },
      // A has no stroke, so it fades in.
      {
        propertyName: 'strokeColor',
        startTime: 100,
        endTime: 400,
        fromValue: '#0000ff00',
        toValue: '#00ff00',
      },
      { propertyName: 'strokeWidth', startTime: 100, endTime: 400, fromValue: 0, toValue: 3 },
    ]);
  });

  it("fades out a fill the other path doesn't have, and starts from animated colors", () => {
    const a = path('a', SQUARE, { fillColor: '#ff0000' });
    const b = path('b', TRIANGLE, { fillColor: '', strokeColor: '#000000', strokeWidth: 1 });
    const recolor = block(a.id, 'fillColor', '#ff0000', '#00ff00', 0, 100);
    const { blocks } = morph(document([a, b], [recolor]), a.id, b.id, 100);
    expect(blocks.find(b => b.propertyName === 'fillColor' && b.id !== recolor.id)).toMatchObject({
      fromValue: '#00ff00',
      toValue: '#0000ff00',
      startTime: 100,
    });
  });

  it("moves past another property's blocks that are in the way", () => {
    const a = path('a', SQUARE, { fillColor: '#ff0000' });
    const b = path('b', TRIANGLE, { fillColor: '#0000ff' });
    const recolor = block(a.id, 'fillColor', '#ff0000', '#00ff00', 200, 500);
    const { pathBlock } = morph(document([a, b], [recolor]), a.id, b.id, 0);
    expect(pathBlock.startTime).toBe(500);
  });

  it('says why it refuses', () => {
    const a = path('a', SQUARE);
    const b = path('b', TRIANGLE);
    const clip = new ClipPathLayer({ name: 'clip', children: [], pathData: new Path(SQUARE) });
    const empty = new PathLayer({ name: 'empty', children: [], pathData: undefined });
    const animatedGroup = new GroupLayer({ name: 'spinning', children: [path('c', SQUARE)] });
    const [c] = animatedGroup.children;
    const blocks = [block(animatedGroup.id, 'rotation', 0, 90)];
    const doc = document([a, b, clip, empty, animatedGroup], blocks);
    const refusal = (fromId: string, toId: string) => getMorphRefusal(doc, fromId, toId, 0);
    expect(refusal(clip.id, a.id)).toBe('Only paths can morph');
    expect(refusal(a.id, clip.id)).toBe('Only paths can morph');
    expect(refusal(a.id, a.id)).toBe("A path can't morph into itself");
    expect(refusal(empty.id, a.id)).toBe('empty has no path');
    expect(refusal(a.id, empty.id)).toBe('empty has no path');
    expect(refusal(a.id, c.id)).toBe("spinning's transform is animated");
    expect(refusal(c.id, a.id)).toBe("spinning's transform is animated");
    expect(refusal(a.id, b.id)).toBeUndefined();

    const animated = document([a, b], [block(b.id, 'fillAlpha', 1, 0)]);
    expect(getMorphRefusal(animated, a.id, b.id, 0)).toBe('b is animated');
    // The path's own transform, which paths get with 2B's transforms.
    const rotated = document([a, b], [block(a.id, 'rotation', 0, 90)]);
    expect(getMorphFromRefusal(rotated, a.id)).toBe("a's transform is animated");
    // A group that both are in can be animated, since they move together.
    const shared = new GroupLayer({ name: 'shared', children: [a, b] });
    expect(
      getMorphRefusal(document([shared], [block(shared.id, 'rotation', 0, 90)]), a.id, b.id, 0),
    ).toBeUndefined();
    // A group that's scaled to nothing can't be mapped out of.
    const flat = new GroupLayer({ name: 'flat', children: [a], scaleX: 0 });
    expect(getMorphRefusal(document([flat, b]), a.id, b.id, 0)).toBe(
      "a's group is scaled to nothing",
    );
  });
});

describe('getMorphTargets', () => {
  it('lists the other paths without blocks, in order, and no clip paths', () => {
    const a = path('a', SQUARE);
    const b = path('b', TRIANGLE);
    const animated = path('animated', TRIANGLE);
    const clip = new ClipPathLayer({ name: 'clip', children: [], pathData: new Path(SQUARE) });
    const inGroup = path('inGroup', TRIANGLE);
    const group = new GroupLayer({ name: 'group', children: [inGroup] });
    const doc = document([a, b, animated, clip, group], [block(animated.id, 'fillAlpha', 1, 0)]);
    expect(getMorphTargets(doc, a.id).map(l => l.name)).toEqual(['b', 'inGroup']);
  });
});

describe('morphLayerSets', () => {
  it('combines each side into one path first, and removes the groups left empty', () => {
    const a = path('a', SQUARE);
    const b1 = path('b1', TRIANGLE);
    const b2 = path('b2', 'M 2 14 L 8 14 L 8 20 Z');
    const imported = new GroupLayer({ name: 'imported', children: [b1, b2] });
    const morphed = morphLayerSets(document([a, imported]), [a.id], [imported.id], 0);
    if ('reason' in morphed) {
      throw new Error(morphed.reason);
    }
    expect(morphed.document.vectorLayer.children.map(l => l.name)).toEqual(['a']);
    const pathBlock = morphed.document.animation.blocks.find(
      b => b.id === morphed.blockId,
    ) as PathAnimationBlock;
    // Both of the imported paths, as subpaths.
    expect(pathBlock.toValue?.getSubPaths().filter(s => !s.isCollapsing())).toHaveLength(2);
    expect(pathBlock.isAnimatable()).toBe(true);
  });

  it("refuses sides with clip paths, which it couldn't morph", () => {
    const a = path('a', SQUARE);
    const clip = new ClipPathLayer({ name: 'clip', children: [], pathData: new Path(SQUARE) });
    const imported = new GroupLayer({ name: 'imported', children: [clip, path('b', TRIANGLE)] });
    expect(morphLayerSets(document([a, imported]), [a.id], [imported.id], 0)).toEqual({
      reason: 'Only paths can morph',
    });
  });

  it('says so when the layers are gone, e.g. deleted before the offer was taken', () => {
    const a = path('a', SQUARE);
    expect(morphLayerSets(document([a]), [a.id], ['deleted'], 0)).toEqual({
      reason: "The layers to morph aren't there anymore",
    });
  });
});

describe('getImportMorphOffer', () => {
  it('offers to morph the one path in the document into what was imported', () => {
    const a = path('a', SQUARE);
    const before = document([a]).vectorLayer;
    const b1 = path('b1', TRIANGLE);
    const b2 = path('b2', 'M 2 14 L 8 14 L 8 20 Z');
    const after = document([a, b1, b2]);
    expect(getImportMorphOffer(before, after, [[b1.id, b2.id]], 0)).toEqual({
      message: "Morph 'a' into the imported shape?",
      fromIds: [a.id],
      toIds: [b1.id, b2.id],
    });
  });

  it('offers to morph one file into the other, imported together into an empty document', () => {
    const before = document([]).vectorLayer;
    const a = path('a', SQUARE);
    const b = path('b', TRIANGLE);
    const after = document([a, b]);
    expect(
      getImportMorphOffer(before, after, [[a.id], [b.id]], 0, ['play.svg', 'pause.svg']),
    ).toEqual({ message: "Morph 'play.svg' into 'pause.svg'?", fromIds: [a.id], toIds: [b.id] });
    // Pasted layers have no file names.
    expect(getImportMorphOffer(before, after, [[a.id], [b.id]], 0)?.message).toBe(
      "Morph 'a' into 'b'?",
    );
  });

  it("doesn't offer it when it wouldn't work, or it isn't clear what to morph", () => {
    const a = path('a', SQUARE);
    const other = path('other', SQUARE);
    const b = path('b', TRIANGLE);
    const c = path('c', TRIANGLE);
    // Two paths already, so which one would morph?
    expect(
      getImportMorphOffer(document([a, other]).vectorLayer, document([a, other, b]), [[b.id]], 0),
    ).toBeUndefined();
    // Nothing there to morph.
    expect(
      getImportMorphOffer(document([]).vectorLayer, document([b]), [[b.id]], 0),
    ).toBeUndefined();
    // Two files into a document that isn't empty.
    expect(
      getImportMorphOffer(document([a]).vectorLayer, document([a, b, c]), [[b.id], [c.id]], 0),
    ).toBeUndefined();
    // A path whose timeline is full.
    const full = [block(a.id, 'pathData', new Path(SQUARE), new Path(SQUARE), 0, 1000)];
    expect(
      getImportMorphOffer(document([a], full).vectorLayer, document([a, b], full), [[b.id]], 0),
    ).toBeUndefined();
    // A clip path was imported.
    const clip = new ClipPathLayer({ name: 'clip', children: [], pathData: new Path(SQUARE) });
    expect(
      getImportMorphOffer(document([a]).vectorLayer, document([a, clip]), [[clip.id]], 0),
    ).toBeUndefined();
  });
});
