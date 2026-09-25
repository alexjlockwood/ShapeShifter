import { ActionSource } from 'app/modules/editor/model/actionmode';
import { Path } from 'app/modules/editor/model/paths';
import { AnimationBlock, PathAnimationBlock } from 'app/modules/editor/model/timeline';

import { checkPathsCompatible } from './ActionModeUtil';

function newBlock(fromValue: string | undefined, toValue: string | undefined) {
  return AnimationBlock.from({
    layerId: 'path',
    propertyName: 'pathData',
    type: 'path',
    fromValue: fromValue === undefined ? undefined : new Path(fromValue),
    toValue: toValue === undefined ? undefined : new Path(toValue),
  }) as PathAnimationBlock;
}

describe('checkPathsCompatible', () => {
  it('returns true if the paths are morphable', () => {
    expect(checkPathsCompatible(newBlock('M 0 0 L 10 10', 'M 5 5 L 20 20'))).toEqual({
      areCompatible: true,
    });
  });

  it('reports the path and subpath that need more points', () => {
    expect(checkPathsCompatible(newBlock('M 0 0 L 10 10', 'M 0 0 L 10 10 L 20 0'))).toEqual({
      areCompatible: false,
      errorPath: ActionSource.From,
      errorSubIdx: 0,
      numPointsMissing: 1,
    });
  });

  it('returns false if either path is empty', () => {
    expect(checkPathsCompatible(newBlock(undefined, undefined))).toEqual({ areCompatible: false });
    expect(checkPathsCompatible(newBlock('M 0 0 L 10 10', undefined))).toEqual({
      areCompatible: false,
    });
    expect(checkPathsCompatible(newBlock(undefined, 'M 0 0 L 10 10'))).toEqual({
      areCompatible: false,
    });
  });
});
