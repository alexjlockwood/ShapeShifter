import { GroupLayer, PathLayer, VectorLayer } from 'app/modules/editor/model/layers';
import { describe, expect, it } from 'vitest';

import { getContextMenuSelection } from './contextMenuSelection';

describe('getContextMenuSelection', () => {
  const a = new PathLayer({ name: 'a', children: [], pathData: undefined });
  const b = new PathLayer({ name: 'b', children: [], pathData: undefined });
  const group = new GroupLayer({ name: 'g', children: [b] });
  const vl = new VectorLayer({ name: 'vl', children: [a, group] });

  it('selects a layer that is not selected, on its own', () => {
    expect(getContextMenuSelection(vl, a.id, new Set([b.id]))).toEqual(new Set([a.id]));
  });

  it('keeps the selection for a selected layer, a layer in a selected group, or nothing', () => {
    expect(getContextMenuSelection(vl, a.id, new Set([a.id, group.id]))).toBeUndefined();
    expect(getContextMenuSelection(vl, b.id, new Set([group.id]))).toBeUndefined();
    expect(getContextMenuSelection(vl, undefined, new Set([a.id]))).toBeUndefined();
    expect(getContextMenuSelection(vl, 'missing', new Set([a.id]))).toBeUndefined();
  });

  it("doesn't count the vector layer, or groups in the layer list, as a selected group", () => {
    expect(getContextMenuSelection(vl, a.id, new Set([vl.id]))).toEqual(new Set([a.id]));
    expect(getContextMenuSelection(vl, b.id, new Set([group.id]), { inGroups: false })).toEqual(
      new Set([b.id]),
    );
  });
});
