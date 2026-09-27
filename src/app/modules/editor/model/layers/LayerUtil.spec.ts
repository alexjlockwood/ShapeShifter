import { MathUtil } from 'app/modules/editor/scripts/common';

import { GroupLayer, VectorLayer } from './Layer';
import { getCanvasTransformForLayer, getCenterPivot } from './LayerUtil';

describe('LayerUtil', () => {
  describe('getCenterPivot', () => {
    function newVectorLayer(...children: GroupLayer[]) {
      return new VectorLayer({ name: 'vector', children, width: 409, height: 300 });
    }

    it('puts the pivot at the center of the viewport', () => {
      const vl = newVectorLayer();
      expect(getCenterPivot(vl, vl.id)).toEqual({ pivotX: 204.5, pivotY: 150 });
    });

    it("converts the center into a transformed parent's coordinates", () => {
      const inner = new GroupLayer({
        name: 'inner',
        children: [],
        rotation: 30,
        scaleX: 2,
        scaleY: 0.5,
        pivotX: 10,
        pivotY: 20,
      });
      const outer = new GroupLayer({
        name: 'outer',
        children: [inner],
        translateX: 50,
        translateY: -25,
      });
      const vl = newVectorLayer(outer);

      expect(getCenterPivot(vl, outer.id)).toEqual({ pivotX: 154.5, pivotY: 175 });

      // A layer in the inner group with this pivot has its pivot at the canvas's center.
      const pivot = getCenterPivot(vl, inner.id);
      const child = new GroupLayer({ name: 'child', children: [], ...pivot });
      inner.children = [child];
      const onCanvas = MathUtil.transformPoint(
        { x: pivot.pivotX, y: pivot.pivotY },
        getCanvasTransformForLayer(vl, child.id),
      );
      expect(onCanvas.x).toBeCloseTo(204.5, 2);
      expect(onCanvas.y).toBeCloseTo(150, 2);
    });

    it('uses the center when the parent is scaled to nothing', () => {
      const group = new GroupLayer({ name: 'group', children: [], scaleX: 0 });
      const vl = newVectorLayer(group);
      expect(getCenterPivot(vl, group.id)).toEqual({ pivotX: 204.5, pivotY: 150 });
    });
  });
});
