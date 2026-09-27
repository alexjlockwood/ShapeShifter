import { POINT_TYPE_OPTIONS } from 'app/modules/editor/components/canvas/pointTypes';
import { Path } from 'app/modules/editor/model/paths';
import * as PathEdit from 'app/modules/editor/model/paths/PathEdit';
import { describe, expect, it } from 'vitest';

import { applyPointCommand, getPointMenuState } from './pointCommands';

function ids(path: Path) {
  return PathEdit.getAnchors(path).map(a => a.id);
}

describe('getPointMenuState', () => {
  it('is undefined without selected points', () => {
    expect(getPointMenuState(new Path('M 0 0 L 4 0 L 4 4 Z'), new Set())).toBeUndefined();
  });

  it('describes one selected point of a closed subpath', () => {
    const path = new Path('M 0 0 L 4 0 L 4 4 Z');
    expect(getPointMenuState(path, new Set([ids(path)[1]]))).toEqual({
      selectedCount: 1,
      pointType: 'straight',
      isSubPathClosed: true,
      toggleClosedReason: undefined,
      setFirstReason: undefined,
    });
  });

  it('says why the commands for one subpath or point are disabled', () => {
    const path = new Path('M 0 0 L 4 0 L 4 4 M 10 0 L 14 0');
    const [a0, a1, , b0] = ids(path);
    expect(getPointMenuState(path, new Set([a1, b0]))).toMatchObject({
      selectedCount: 2,
      isSubPathClosed: undefined,
      toggleClosedReason: 'The points are in different subpaths',
      setFirstReason: 'Select just one point',
    });
    expect(getPointMenuState(path, new Set([a0]))?.setFirstReason).toBe(
      'An open subpath starts at one of its ends',
    );
    const dot = new Path('M 0 0 L 4 0 M 10 10');
    expect(getPointMenuState(dot, new Set([ids(dot)[2]]))?.toggleClosedReason).toBe(
      'A subpath needs two points to close',
    );
  });
});

describe('applyPointCommand', () => {
  it('opens and closes the subpath with the selected points', () => {
    const path = new Path('M 0 0 L 4 0 L 4 4 Z');
    const selection = new Set([ids(path)[1]]);
    const opened = applyPointCommand(path, selection, { type: 'toggleClosed' })?.path;
    expect(opened?.getPathString()).toBe('M 0 0 L 4 0 L 4 4 L 0 0');
    const closed = opened && applyPointCommand(opened, selection, { type: 'toggleClosed' })?.path;
    expect(closed?.getPathString()).toBe('M 0 0 L 4 0 L 4 4 Z');
  });

  it('makes the selected point the first', () => {
    const path = new Path('M 0 0 L 4 0 L 4 4 Z');
    const selection = new Set([ids(path)[2]]);
    const result = applyPointCommand(path, selection, { type: 'setFirstPoint' });
    expect(result?.path.getPathString()).toBe('M 4 4 L 0 0 L 4 0 Z');
    expect(
      applyPointCommand(path, new Set([ids(path)[0]]), { type: 'setFirstPoint' }),
    ).toBeUndefined();
  });

  it('changes the selected points type', () => {
    const path = new Path('M 0 0 L 4 0 L 8 0');
    const result = applyPointCommand(path, new Set([ids(path)[1]]), {
      type: 'setPointType',
      pointType: 'mirrored',
    });
    expect(PathEdit.getAnchors(result?.path ?? path)[1].type).toBe('mirrored');
  });
});

it('lists the point types in the order of their shortcuts', () => {
  expect(POINT_TYPE_OPTIONS.map(o => o.value)).toEqual(PathEdit.POINT_TYPES);
});
