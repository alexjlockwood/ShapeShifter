import { ActionMode, ActionSource } from 'app/modules/editor/model/actionmode';
import { PathLayer } from 'app/modules/editor/model/layers';
import { Path } from 'app/modules/editor/model/paths';
import { AnimationBlock, PathAnimationBlock } from 'app/modules/editor/model/timeline';

import { type ActionModeStatusOptions, getActionModeStatus } from './actionModeStatus';

const TRIANGLE = 'M 8 5 L 8 19 L 19 12 Z';
const SQUARE = 'M 6 5 L 10 5 L 10 19 L 6 19 Z';

function block(from: string | undefined, to: string | undefined) {
  return AnimationBlock.from({
    layerId: 'path',
    propertyName: 'pathData',
    type: 'path',
    fromValue: from === undefined ? undefined : new Path(from),
    toValue: to === undefined ? undefined : new Path(to),
  }) as PathAnimationBlock;
}

const filled = new PathLayer({
  name: 'path',
  children: [],
  pathData: undefined,
  fillColor: '#000',
});
const stroked = new PathLayer({
  name: 'path',
  children: [],
  pathData: undefined,
  strokeColor: '#000',
});

function status(options: Partial<ActionModeStatusOptions>) {
  return getActionModeStatus({
    mode: ActionMode.Selection,
    block: block(SQUARE, SQUARE),
    layer: filled,
    unpairedSubPathSource: undefined,
    hasSelections: false,
    ...options,
  });
}

describe('getActionModeStatus', () => {
  it('says nothing outside of action mode, or without a block', () => {
    expect(status({ mode: ActionMode.None })).toBeUndefined();
    // Undo can deselect the block before action mode closes.
    expect(status({ block: undefined })).toBeUndefined();
  });

  it('says that the paths morph, and what to do next', () => {
    expect(status({})).toEqual({
      morphs: true,
      summary: 'Morphs',
      hint: 'Click a subpath to edit it',
      canAutoFix: false,
    });
    expect(status({ hasSelections: true })?.hint).toBe('');
  });

  it('says which subpath is missing points, numbered from 1', () => {
    const paths = block(`${SQUARE} ${TRIANGLE}`, `${SQUARE} ${SQUARE}`);
    expect(status({ block: paths })).toEqual({
      morphs: false,
      summary: "Doesn't morph: subpath 2 has 4 points at the start and 5 at the end",
      hint: 'Add 1 point to the highlighted subpath at the start',
      canAutoFix: true,
    });
    expect(status({ block: block(`${SQUARE} ${SQUARE}`, `${SQUARE} M 0 0 L 1 1`) })).toEqual({
      morphs: false,
      summary: "Doesn't morph: subpath 2 has 5 points at the start and 2 at the end",
      hint: 'Add 3 points to the highlighted subpath at the end',
      canAutoFix: true,
    });
  });

  it('keeps saying how to fix the paths while something is selected', () => {
    expect(status({ block: block(TRIANGLE, SQUARE), hasSelections: true })?.hint).toBe(
      'Add 1 point to the highlighted subpath at the start',
    );
  });

  it('says when the paths have different numbers of subpaths', () => {
    expect(status({ block: block(SQUARE, `${SQUARE} ${SQUARE}`) })).toEqual({
      morphs: false,
      summary: "Doesn't morph: the start has 1 subpath and the end has 2",
      hint: '',
      canAutoFix: true,
    });
  });

  it("says when a path is empty, which auto fix can't fix", () => {
    expect(status({ block: block(undefined, SQUARE) })).toMatchObject({
      morphs: false,
      summary: "Doesn't morph: the start path is empty",
      canAutoFix: false,
    });
    expect(status({ block: block(SQUARE, '') })?.summary).toBe(
      "Doesn't morph: the end path is empty",
    );
    expect(status({ block: block(undefined, undefined) })?.summary).toBe(
      "Doesn't morph: both paths are empty",
    );
  });

  it("says how to use each mode's tool", () => {
    expect(status({ mode: ActionMode.SplitCommands })?.hint).toBe(
      'Click along the edge of a subpath to add a point',
    );
    expect(status({ mode: ActionMode.SplitSubPaths })?.hint).toBe(
      'Draw a line across a subpath to split it into 2',
    );
    expect(status({ mode: ActionMode.SplitSubPaths, layer: stroked })?.hint).toBe(
      'Click along the edge of a subpath to split it into 2',
    );
    expect(status({ mode: ActionMode.PairSubPaths })?.hint).toBe(
      'Select a subpath at the start or the end to pair it',
    );
    expect(
      status({ mode: ActionMode.PairSubPaths, unpairedSubPathSource: ActionSource.From })?.hint,
    ).toBe('Now select the subpath at the end to pair it with');
    expect(
      status({ mode: ActionMode.PairSubPaths, unpairedSubPathSource: ActionSource.To })?.hint,
    ).toBe('Now select the subpath at the start to pair it with');
  });

  it('still says whether the paths morph in the other modes', () => {
    expect(
      status({ mode: ActionMode.SplitCommands, block: block(TRIANGLE, SQUARE) }),
    ).toMatchObject({ morphs: false, canAutoFix: true });
  });
});
