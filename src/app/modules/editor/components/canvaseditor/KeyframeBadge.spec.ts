import type { PathKeyframe } from 'app/modules/editor/components/canvas/pathKeyframes';
import { Path } from 'app/modules/editor/model/paths';
import { AnimationBlock, PathAnimationBlock } from 'app/modules/editor/model/timeline';
import { describe, expect, it } from 'vitest';

import { getKeyframeStatus } from './KeyframeBadge';

function block(from: string, to: string) {
  return AnimationBlock.from({
    id: 'b',
    layerId: 'p',
    propertyName: 'pathData',
    startTime: 100,
    endTime: 200,
    interpolator: 'LINEAR',
    type: 'path',
    fromValue: new Path(from),
    toValue: new Path(to),
  }) as PathAnimationBlock;
}

describe('getKeyframeStatus', () => {
  it("says nothing about a path that isn't animated", () => {
    expect(getKeyframeStatus({ type: 'static', path: undefined }, 0)).toBeUndefined();
  });

  it('says where the edit is, and whether the morph still works', () => {
    const morphs = block('M 0 0 L 1 1', 'M 0 0 L 2 2');
    const keyframe: PathKeyframe = {
      type: 'keyframe',
      path: morphs.fromValue,
      targets: [{ kind: 'fromValue', blockId: 'b' }],
      blocks: [morphs],
    };
    expect(getKeyframeStatus(keyframe, 100)).toEqual({
      type: 'keyframe',
      label: 'Start of the morph, at 100 ms',
      brokenBlockIds: [],
    });
    const broken = block('M 0 0 L 1 1', 'M 0 0 L 2 2 L 3 3');
    expect(
      getKeyframeStatus(
        { ...keyframe, targets: [{ kind: 'toValue', blockId: 'b' }], blocks: [broken] },
        200,
      ),
    ).toEqual({ type: 'keyframe', label: 'End of the morph, at 200 ms', brokenBlockIds: ['b'] });
  });

  it("says when the path is morphing, so it can't be edited", () => {
    expect(getKeyframeStatus({ type: 'between', block: block('M 0 0', 'M 1 1') }, 150)).toEqual({
      type: 'between',
      startTime: 100,
      endTime: 200,
    });
  });
});
