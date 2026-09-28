import { PathLayer, VectorLayer } from 'app/modules/editor/model/layers';
import { Path } from 'app/modules/editor/model/paths';
import { Animation, AnimationBlock, PathAnimationBlock } from 'app/modules/editor/model/timeline';
import { AutoAwesome } from 'app/modules/editor/scripts/algorithms';
import { describe, expect, it } from 'vitest';

import type { CanvasDocument } from './CanvasPreview';
import { autoFixPathBlocks, getPathKeyframe, setKeyframePath } from './pathKeyframes';

const A = 'M 0 0 L 10 0 L 10 10 Z';
const B = 'M 0 0 L 12 0 L 12 12 Z';
const C = 'M 0 0 L 14 0 L 14 14 Z';

function block(
  id: string,
  startTime: number,
  endTime: number,
  from: string | Path,
  to: string | Path,
) {
  return AnimationBlock.from({
    id,
    layerId: 'p',
    propertyName: 'pathData',
    startTime,
    endTime,
    interpolator: 'LINEAR',
    type: 'path',
    fromValue: typeof from === 'string' ? new Path(from) : from,
    toValue: typeof to === 'string' ? new Path(to) : to,
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

  describe('with icons', () => {
    // Material icons, with a different number of subpaths.
    const ICONS = {
      play: 'M8 5v14l11-7z',
      pause: 'M6 19h4V5H6v14zm8-14v14h4V5h-4z',
      line: 'M19 13H5v-2h14v2z',
      stop: 'M6 6h12v12H6z',
      add: 'M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z',
      menu: 'M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z',
      check: 'M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z',
      close:
        'M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z',
      star: 'M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z',
    };
    type Icon = keyof typeof ICONS;

    /** A path that morphs through the icons, one block after another, from its own path. */
    function chain(...icons: ReadonlyArray<Icon>) {
      return document(
        ICONS[icons[0]],
        icons
          .slice(1)
          .map((to, i) => block(`${i}`, i * 100, i * 100 + 100, ICONS[icons[i]], ICONS[to])),
      );
    }

    function getBlocks(doc: CanvasDocument) {
      return doc.animation.blocks as PathAnimationBlock[];
    }

    function getBase(doc: CanvasDocument) {
      return (doc.vectorLayer.findLayerById('p') as PathLayer).pathData;
    }

    it('stops sharing a keyframe whose fixes undo each other', () => {
      // Fixing pause to line gives the line a collapsing subpath, for the pause's second bar, and
      // fixing line to play takes it away again.
      const doc = chain('pause', 'line', 'play');
      const fixed = autoFixPathBlocks(doc, new Set(['0', '1']));
      const [first, second] = getBlocks(fixed);
      expect([first.isAnimatable(), second.isAnimatable()]).toEqual([true, true]);
      expect(first.toValue?.getSubPaths()).toHaveLength(2);
      expect(second.fromValue?.getSubPaths()).toHaveLength(1);
      // Both copies of the line still draw it.
      const line = new Path(ICONS.line).getBoundingBox();
      expect(first.toValue?.getBoundingBox()).toEqual(line);
      expect(second.fromValue?.getBoundingBox()).toEqual(line);
      // The layer's own path stays linked to the first block.
      expect(getBase(fixed)?.getPathString()).toBe(first.fromValue?.getPathString());
    });

    it('never breaks a block that morphed before', () => {
      // Pause to line was already fixed, and the line it ends with starts the next block.
      const [pause, line] = AutoAwesome.autoFix(new Path(ICONS.pause), new Path(ICONS.line));
      const doc = document(ICONS.pause, [
        block('0', 0, 100, pause, line),
        block('1', 100, 200, line, ICONS.play),
      ]);
      const [first] = getBlocks(doc);
      expect(first.isAnimatable()).toBe(true);
      const fixed = autoFixPathBlocks(doc, new Set(['1']));
      const [fixedFirst, fixedSecond] = getBlocks(fixed);
      expect(fixedFirst.fromValue).toBe(pause);
      expect(fixedFirst.toValue).toBe(line);
      expect(fixedSecond.isAnimatable()).toBe(true);
    });

    it('keeps sharing the keyframes it can', () => {
      // Stop to play to stop all have one subpath, so fixing either block fits the other.
      const fixed = autoFixPathBlocks(chain('stop', 'play', 'stop'), new Set(['0', '1']));
      const [first, second] = getBlocks(fixed);
      expect([first.isAnimatable(), second.isAnimatable()]).toEqual([true, true]);
      expect(first.toValue?.getPathString()).toBe(second.fromValue?.getPathString());
    });

    // A fixed seed, so that a failure can be reproduced.
    function random(seed: number) {
      return () => {
        seed = (seed * 1103515245 + 12345) % 2 ** 31;
        return seed / 2 ** 31;
      };
    }

    it('never breaks a block, and fixes each one that auto fix can fix on its own', () => {
      const next = random(1);
      const pick = <T>(items: ReadonlyArray<T>) => items[Math.floor(next() * items.length)];
      const icons = Object.keys(ICONS) as Icon[];
      const canFixAlone = (from: Icon, to: Icon) => {
        const [f, t] = AutoAwesome.autoFix(new Path(ICONS[from]), new Path(ICONS[to]));
        return f.isMorphableWith(t);
      };
      const failures: string[] = [];
      for (let n = 0; n < 30; n++) {
        const chained = Array.from({ length: 3 + Math.floor(next() * 3) }, () => pick(icons));
        const doc = chain(...chained);
        const blocks = getBlocks(doc);
        // Either every block that doesn't morph, as the context menu does with all of them
        // selected, or one of them, as Morph into and the canvas editor do.
        const broken = blocks.filter(b => !b.isAnimatable()).map(b => b.id);
        const targets = new Set(n % 2 ? broken : broken.slice(0, 1));
        const fixed = getBlocks(autoFixPathBlocks(doc, targets));
        blocks.forEach((b, i) => {
          const mustMorph =
            b.isAnimatable() || (targets.has(b.id) && canFixAlone(chained[i], chained[i + 1]));
          if (mustMorph && !fixed[i].isAnimatable()) {
            failures.push(`${chained.join(' to ')}, block ${i}`);
          }
        });
      }
      expect(failures).toEqual([]);
    });
  });
});
