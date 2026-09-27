import { PathLayer, VectorLayer } from 'app/modules/editor/model/layers';
import { Path } from 'app/modules/editor/model/paths';
import { Animation, AnimationBlock, PathAnimationBlock } from 'app/modules/editor/model/timeline';
import { describe, expect, it } from 'vitest';

import type { CanvasDocument } from './CanvasPreview';
import { autoFixPathBlocks, getPathKeyframe, setKeyframePath } from './pathKeyframes';

const A = 'M 0 0 L 10 0 L 10 10 Z';
const B = 'M 0 0 L 12 0 L 12 12 Z';
const C = 'M 0 0 L 14 0 L 14 14 Z';

function block(id: string, startTime: number, endTime: number, from: string, to: string) {
  return AnimationBlock.from({
    id,
    layerId: 'p',
    propertyName: 'pathData',
    startTime,
    endTime,
    interpolator: 'LINEAR',
    type: 'path',
    fromValue: new Path(from),
    toValue: new Path(to),
  }) as PathAnimationBlock;
}

/** A path that morphs from A to B from 100 to 200 ms, and from B to C from 300 to 400 ms. */
function document(base = A, blocks = [block('1', 100, 200, A, B), block('2', 300, 400, B, C)]) {
  const layer = new PathLayer({ id: 'p', name: 'p', children: [], pathData: new Path(base) });
  const animation = new Animation();
  animation.blocks = blocks;
  return { vectorLayer: new VectorLayer({ name: 'vl', children: [layer] }), animation };
}

function describeKeyframe(doc: CanvasDocument, time: number) {
  const keyframe = getPathKeyframe(doc, 'p', time);
  if (keyframe?.type !== 'keyframe') {
    return keyframe?.type;
  }
  return {
    path: keyframe.path?.getPathString(),
    targets: keyframe.targets.map(t => (t.kind === 'base' ? 'base' : `${t.blockId}.${t.kind}`)),
  };
}

describe('getPathKeyframe', () => {
  it("edits a path that isn't animated", () => {
    expect(getPathKeyframe(document(A, []), 'p', 0)?.type).toBe('static');
  });

  it('edits the value that shows, and the other side of a hold if it matches', () => {
    const doc = document();
    expect(describeKeyframe(doc, 0)).toEqual({ path: A, targets: ['base', '1.fromValue'] });
    expect(describeKeyframe(doc, 100)).toEqual({ path: A, targets: ['1.fromValue', 'base'] });
    expect(describeKeyframe(doc, 150)).toBe('between');
    expect(describeKeyframe(doc, 200)).toEqual({ path: B, targets: ['1.toValue', '2.fromValue'] });
    expect(describeKeyframe(doc, 250)).toEqual({ path: B, targets: ['1.toValue', '2.fromValue'] });
    expect(describeKeyframe(doc, 300)).toEqual({ path: B, targets: ['2.fromValue', '1.toValue'] });
    expect(describeKeyframe(doc, 400)).toEqual({ path: C, targets: ['2.toValue'] });
  });

  it("leaves the other side of a hold alone if it's a different path", () => {
    const doc = document(C);
    expect(describeKeyframe(doc, 0)).toEqual({ path: C, targets: ['base'] });
    expect(describeKeyframe(doc, 100)).toEqual({ path: A, targets: ['1.fromValue'] });
  });

  it('lists the blocks an edit changes, to check that they still morph', () => {
    const keyframe = getPathKeyframe(document(), 'p', 250);
    expect(keyframe?.type === 'keyframe' && keyframe.blocks.map(b => b.id)).toEqual(['1', '2']);
  });
});

describe('setKeyframePath', () => {
  it('saves the path in each of the targets', () => {
    const doc = document();
    const path = new Path('M 1 1 L 12 0 L 12 12 Z');
    const edited = setKeyframePath(
      doc,
      'p',
      [
        { kind: 'toValue', blockId: '1' },
        { kind: 'fromValue', blockId: '2' },
      ],
      path,
    );
    expect(edited.vectorLayer).toBe(doc.vectorLayer);
    const [first, second] = edited.animation.blocks as PathAnimationBlock[];
    expect(first.toValue?.getPathString()).toBe(path.getPathString());
    expect(second.fromValue?.getPathString()).toBe(path.getPathString());
    expect(first.fromValue?.getPathString()).toBe(A);
    // The document it came from is left as it was.
    expect((doc.animation.blocks[0] as PathAnimationBlock).toValue?.getPathString()).toBe(B);
  });
});

describe('autoFixPathBlocks', () => {
  const SQUARE = 'M 0 0 L 12 0 L 12 12 L 0 12 Z';

  function paths(doc: CanvasDocument) {
    const [first, second] = doc.animation.blocks as PathAnimationBlock[];
    const layer = doc.vectorLayer.findLayerById('p') as PathLayer;
    return {
      base: layer.pathData?.getPathString(),
      first: [first.fromValue?.getPathString(), first.toValue?.getPathString()],
      second: [second.fromValue?.getPathString(), second.toValue?.getPathString()],
      morphs: [first.isAnimatable(), second.isAnimatable()],
    };
  }

  it('keeps the values linked to the ends it fixes the same, and fixes the blocks that breaks', () => {
    // A triangle that grows, and then morphs into a square, which doesn't work.
    const doc = document(A, [block('1', 100, 200, A, B), block('2', 300, 400, B, SQUARE)]);
    expect(paths(doc).morphs).toEqual([true, false]);
    const fixed = paths(autoFixPathBlocks(doc, new Set(['2'])));
    // The bigger triangle gets a point to morph into the square, so the first block has to change
    // too, and so does the layer's own path, which is the same as its start.
    expect(fixed.first[1]).not.toBe(B);
    expect(fixed.morphs).toEqual([true, true]);
    expect(fixed.base).toBe(fixed.first[0]);
    expect(fixed.first[1]).toBe(fixed.second[0]);
    expect(fixed.second[1]).toBe(SQUARE);
  });

  it("leaves values that aren't linked, and blocks that were already broken, alone", () => {
    const doc = document(C, [block('1', 100, 200, A, SQUARE), block('2', 300, 400, B, SQUARE)]);
    const fixed = autoFixPathBlocks(doc, new Set(['1']));
    expect(fixed.vectorLayer).toBe(doc.vectorLayer);
    expect(paths(fixed).morphs).toEqual([true, false]);
    expect(paths(fixed).second).toEqual([B, SQUARE]);
    expect(autoFixPathBlocks(doc, new Set())).toBe(doc);
  });
});
