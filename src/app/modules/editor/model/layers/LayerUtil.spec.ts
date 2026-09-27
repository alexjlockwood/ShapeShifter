import { Path } from 'app/modules/editor/model/paths';
import { Animation, AnimationBlock } from 'app/modules/editor/model/timeline';
import { MathUtil, Matrix } from 'app/modules/editor/scripts/common';

import { ClipPathLayer, getTransformMatrix, GroupLayer, PathLayer, VectorLayer } from './Layer';
import {
  adjustViewports,
  getCanvasTransformForLayer,
  getCenterPivot,
  getParentTransformForLayer,
  isSkewed,
  pathUsesTransform,
  toTransform,
} from './LayerUtil';

const TRANSFORM = { rotation: 30, scaleX: 2, scaleY: 0.5, pivotX: 3, pivotY: 4, translateX: 5 };

function newPath(props: Partial<PathLayer> = {}) {
  return new PathLayer({
    name: 'path',
    children: [],
    pathData: new Path('M 0 0 L 10 0 L 10 2 Z'),
    ...props,
  });
}

function expectMatrixCloseTo(actual: Matrix, expected: Matrix) {
  const { a, b, c, d, e, f } = expected;
  expect(
    [actual.a, actual.b, actual.c, actual.d, actual.e, actual.f].map(n => n.toFixed(6)),
  ).toEqual([a, b, c, d, e, f].map(n => n.toFixed(6)));
}

describe('LayerUtil', () => {
  describe('getCanvasTransformForLayer', () => {
    it("includes a path's own transform, like a group around it", () => {
      const path = newPath(TRANSFORM);
      const outer = new GroupLayer({
        name: 'outer',
        children: [path],
        rotation: -15,
        translateY: 2,
      });
      const vl = new VectorLayer({ name: 'vector', children: [outer] });

      const wrapped = newPath();
      const wrapper = new GroupLayer({ name: 'wrapper', children: [wrapped], ...TRANSFORM });
      const wrappedVl = new VectorLayer({
        name: 'vector',
        children: [
          new GroupLayer({ name: 'outer', children: [wrapper], rotation: -15, translateY: 2 }),
        ],
      });

      expectMatrixCloseTo(
        getCanvasTransformForLayer(vl, path.id),
        getCanvasTransformForLayer(wrappedVl, wrapped.id),
      );
      // Without it, only the groups it's in.
      expectMatrixCloseTo(
        getParentTransformForLayer(vl, path.id),
        getCanvasTransformForLayer(vl, outer.id).dot(getTransformMatrix(outer)),
      );
    });

    it("doesn't include a group's own transform, which is for its children", () => {
      const group = new GroupLayer({ name: 'group', children: [], rotation: 90 });
      const vl = new VectorLayer({ name: 'vector', children: [group] });
      expect(getCanvasTransformForLayer(vl, group.id).equals(Matrix.identity())).toBe(true);
    });
  });

  describe('pathUsesTransform', () => {
    it('is true for a rotated, scaled, or translated path, or an animated one', () => {
      expect(pathUsesTransform(newPath())).toBe(false);
      expect(pathUsesTransform(newPath({ pivotX: 12, pivotY: 12 }))).toBe(false);
      expect(pathUsesTransform(newPath({ rotation: 1 }))).toBe(true);
      expect(pathUsesTransform(newPath({ scaleX: -1 }))).toBe(true);
      expect(pathUsesTransform(newPath({ translateY: 0.5 }))).toBe(true);

      const path = newPath();
      const animation = new Animation();
      animation.blocks = [
        AnimationBlock.from({
          type: 'number',
          layerId: path.id,
          propertyName: 'fillAlpha',
          fromValue: 0,
          toValue: 1,
        }),
      ];
      expect(pathUsesTransform(path, animation)).toBe(false);
      animation.blocks = [
        ...animation.blocks,
        AnimationBlock.from({
          type: 'number',
          layerId: path.id,
          propertyName: 'pivotX',
          fromValue: 0,
          toValue: 1,
        }),
      ];
      expect(pathUsesTransform(path, animation)).toBe(true);
    });

    it('is false for other layers', () => {
      expect(pathUsesTransform(new GroupLayer({ name: 'g', children: [], rotation: 5 }))).toBe(
        false,
      );
      expect(pathUsesTransform(undefined)).toBe(false);
    });
  });

  describe('toTransform', () => {
    it('gives back the matrix of a transform, with its pivot at 0', () => {
      for (const transform of [
        TRANSFORM,
        { rotation: 135, scaleX: 1, scaleY: 1 },
        { rotation: -100, scaleX: 3, scaleY: -2, translateY: 7 },
        { scaleX: 0, rotation: 20 },
        { scaleX: 0, scaleY: 0 },
      ]) {
        const matrix = getTransformMatrix(newPath(transform));
        const result = toTransform(matrix);
        expect(result.pivotX).toBe(0);
        expect(isSkewed(matrix)).toBe(false);
        expectMatrixCloseTo(getTransformMatrix(result), matrix);
      }
    });

    it('says when a matrix skews, which no transform can do', () => {
      const scaled = getTransformMatrix(newPath({ scaleX: 2 }));
      const rotated = getTransformMatrix(newPath({ rotation: 30 }));
      expect(isSkewed(rotated.dot(scaled))).toBe(false);
      expect(isSkewed(scaled.dot(rotated))).toBe(true);
    });
  });

  describe('adjustViewports', () => {
    it('centers a smaller viewport after scaling it (MODEL-2)', () => {
      const big = new VectorLayer({ name: 'big', children: [newPath()], width: 24, height: 24 });
      const icon = newPath({ pathData: new Path('M 0 0 L 12 0 L 12 6 L 0 6 Z') });
      const small = new VectorLayer({ name: 'small', children: [icon], width: 12, height: 6 });
      const { vl2 } = adjustViewports(big, small);
      expect(vl2.children[0].bounds).toEqual({ l: 0, t: 6, r: 24, b: 18 });
    });

    it('keeps rotated and scaled groups and paths turning around the same place', () => {
      // Where a point of the path is drawn, which moves with the path's own coordinates.
      const place = (vl: VectorLayer, id: string, point: { x: number; y: number }) =>
        MathUtil.transformPoint(point, getCanvasTransformForLayer(vl, id));
      const path = newPath({ ...TRANSFORM, strokeColor: '#000', strokeWidth: 1 });
      const child = newPath({ name: 'child' });
      const group = new GroupLayer({
        name: 'group',
        children: [child],
        ...TRANSFORM,
        rotation: 45,
      });
      const clipPath = new ClipPathLayer({
        name: 'mask',
        children: [],
        pathData: new Path('M 1 1 L 2 2'),
      });
      const small = new VectorLayer({
        name: 'small',
        children: [path, group, clipPath],
        width: 12,
        height: 6,
      });
      const big = new VectorLayer({ name: 'big', children: [], width: 24, height: 24 });
      const { vl2 } = adjustViewports(big, small);

      // Everything is scaled by 2 and moved down by 6, the same way, on the canvas and in each
      // path's own coordinates.
      const adjust = (p: { x: number; y: number }) => ({ x: p.x * 2, y: p.y * 2 + 6 });
      for (const id of [path.id, child.id]) {
        const point = { x: 1, y: 1 };
        const expected = adjust(place(small, id, point));
        const after = place(vl2, id, adjust(point));
        expect(after.x).toBeCloseTo(expected.x, 6);
        expect(after.y).toBeCloseTo(expected.y, 6);
      }
      const adjustedPath = vl2.findLayerById(path.id) as PathLayer;
      expect([adjustedPath.rotation, adjustedPath.scaleX, adjustedPath.strokeWidth]).toEqual([
        30, 2, 2,
      ]);
      expect([adjustedPath.pivotX, adjustedPath.pivotY]).toEqual([6, 14]);
      const clipPathData = (vl2.findLayerById(clipPath.id) as ClipPathLayer).pathData;
      expect(clipPathData?.getPathString()).toBe('M 2 8 L 4 10');
    });
  });

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
