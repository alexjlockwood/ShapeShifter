import { Path } from 'app/modules/editor/model/paths';
import { Animation, AnimationBlock } from 'app/modules/editor/model/timeline';

import { type FillType, GroupLayer, PathLayer, type StrokeLineJoin, VectorLayer } from '.';

// Registered properties are stored behind prototype accessors, so class fields with the
// same name must not shadow them (and bypass their setters).
describe('Property.register', () => {
  it('stores layer properties through their accessors', () => {
    const layer = new PathLayer({
      name: 'path',
      children: [],
      pathData: 'M 0 0 L 10 10' as unknown as Path,
    });
    expect(Object.getOwnPropertyNames(layer)).not.toContain('name');
    expect(Object.getOwnPropertyNames(layer)).not.toContain('pathData');
    expect(layer.name).toBe('path');
    expect(layer.pathData).toBeInstanceOf(Path);
    expect(layer.pathData!.getPathString()).toBe('M 0 0 L 10 10');
  });

  it('runs property setters', () => {
    const vl = new VectorLayer({
      name: 'vector',
      children: [],
      width: '12.7' as unknown as number,
    });
    expect(vl.width).toBe(12);
    const group = new GroupLayer({ name: 'group', children: [], scaleX: '2' as unknown as number });
    expect(group.scaleX).toBe(2);
    expect(new Animation({ duration: 5 }).duration).toBe(100);
  });

  it('inherits registered properties from superclasses', () => {
    const vl = new VectorLayer();
    expect([...vl.inspectableProperties.keys()]).toEqual([
      'name',
      'canvasColor',
      'width',
      'height',
      'alpha',
    ]);
    expect([...vl.animatableProperties.keys()]).toEqual(['alpha']);
    const block = AnimationBlock.from({
      type: 'path',
      layerId: '1',
      propertyName: 'pathData',
      fromValue: new Path('M 0 0 L 1 1'),
      toValue: new Path('M 1 1 L 2 2'),
    });
    expect([...block.inspectableProperties.keys()]).toEqual([
      'startTime',
      'endTime',
      'interpolator',
      'fromValue',
      'toValue',
    ]);
  });

  it('replaces invalid enum values with their defaults', () => {
    const layer = new PathLayer({
      name: 'path',
      children: [],
      pathData: new Path('M 0 0 L 10 10'),
      strokeLinecap: 'round',
      // Older versions imported the line cap as the line join.
      strokeLinejoin: 'square' as StrokeLineJoin,
      fillType: 'evenodd' as FillType,
    });
    expect(layer.strokeLinecap).toBe('round');
    expect(layer.strokeLinejoin).toBe('miter');
    expect(layer.fillType).toBe('nonZero');
    const property = layer.inspectableProperties.get('strokeLinejoin')!;
    expect(property.displayValueForValue(layer.strokeLinejoin)).toBe('Miter');
    expect(property.displayValueForValue('square')).toBe('square');

    const block = AnimationBlock.from({
      type: 'number',
      layerId: layer.id,
      propertyName: 'strokeWidth',
      fromValue: 1,
      toValue: 2,
      interpolator: 'NOT_AN_INTERPOLATOR',
    });
    expect(block.interpolator).toBe('FAST_OUT_SLOW_IN');
  });

  it('converts colors that Android does not support', () => {
    const layer = new PathLayer({
      name: 'path',
      children: [],
      pathData: new Path('M 0 0 L 10 10'),
      fillColor: 'red',
      strokeColor: 'none',
    });
    expect(layer.fillColor).toBe('#ff0000');
    expect(layer.strokeColor).toBe('');
    const property = layer.inspectableProperties.get('fillColor')!;
    property.setEditableValue(layer, 'fillColor', 'none');
    expect(layer.fillColor).toBeUndefined();
    expect(layer.isFilled()).toBe(false);
    property.setEditableValue(layer, 'fillColor', 'blue');
    expect(layer.fillColor).toBe('#0000ff');
  });

  it('replaces path data that is not a path', () => {
    const newLayer = (pathData: any) => new PathLayer({ name: 'path', children: [], pathData });
    expect(newLayer(5).pathData).toBeUndefined();
    expect(newLayer({ commands: [] }).pathData).toBeUndefined();
    expect(newLayer('M 0 0 L 10 10').pathData?.getPathString()).toBe('M 0 0 L 10 10');
  });
});

describe('GroupLayer.bounds', () => {
  // MODEL-9: only two corners used to be transformed, so rotated bounds could be inside out.
  it('contains its rotated children', () => {
    const path = new PathLayer({
      name: 'path',
      children: [],
      pathData: new Path('M 0 0 L 10 0 L 10 2 L 0 2 Z'),
    });
    const group = new GroupLayer({ name: 'group', children: [path], rotation: 90 });
    const { l, t, r, b } = group.bounds!;
    expect(l).toBeCloseTo(-2, 9);
    expect(t).toBeCloseTo(0, 9);
    expect(r).toBeCloseTo(0, 9);
    expect(b).toBeCloseTo(10, 9);
  });

  it('contains children that are transformed themselves', () => {
    const path = new PathLayer({
      name: 'path',
      children: [],
      pathData: new Path('M 0 0 L 10 0 L 10 2 L 0 2 Z'),
      rotation: 90,
    });
    const group = new GroupLayer({ name: 'group', children: [path], translateX: 5 });
    const { l, t, r, b } = group.bounds!;
    expect([l, t, r, b].map(n => Math.round(n * 1e6) / 1e6)).toEqual([3, 0, 5, 10]);
  });
});

describe('PathLayer transforms', () => {
  function newPath(props: object = {}) {
    return new PathLayer({
      name: 'path',
      children: [],
      pathData: new Path('M 0 0 L 10 0 L 10 2 L 0 2 Z'),
      ...props,
    });
  }

  it("has a group's transform properties, with the same names, after its own", () => {
    const names = [...newPath().inspectableProperties.keys()];
    const transformNames = [
      'rotation',
      'scaleX',
      'scaleY',
      'pivotX',
      'pivotY',
      'translateX',
      'translateY',
    ];
    expect(names.slice(-7)).toEqual(transformNames);
    expect([...newPath().animatableProperties.keys()]).toEqual(
      expect.arrayContaining(transformNames),
    );
    const group = new GroupLayer({ name: 'group', children: [] });
    expect([...group.animatableProperties.keys()]).toEqual(transformNames);
  });

  it('defaults to the identity, which its JSON leaves out', () => {
    const path = newPath();
    expect([path.rotation, path.scaleX, path.scaleY, path.pivotX, path.translateY]).toEqual([
      0, 1, 1, 0, 0,
    ]);
    expect(Object.keys(path.toJSON())).toEqual(['id', 'name', 'type', 'pathData']);
    const json = newPath({ rotation: 30, pivotX: 5, scaleY: 1 }).toJSON();
    expect(json).toMatchObject({ rotation: 30, pivotX: 5 });
    expect(json).not.toHaveProperty('scaleY');
  });

  it('keeps its transform when cloned or loaded from JSON', () => {
    const path = newPath({ rotation: 30, scaleX: 2, translateY: -1 });
    expect(path.clone()).toMatchObject({ rotation: 30, scaleX: 2, translateY: -1 });
    const vl = new VectorLayer({
      name: 'vector',
      children: [path.toJSON() as any],
    });
    expect(vl.children[0]).toMatchObject({ rotation: 30, scaleX: 2, translateY: -1 });
  });

  it('replaces values that are not numbers with the defaults', () => {
    const path = newPath({ rotation: 'abc', scaleX: null, translateX: '3', pivotY: Infinity });
    expect([path.rotation, path.scaleX, path.translateX, path.pivotY]).toEqual([0, 1, 3, 0]);
  });

  it('has bounds in its parent coordinates, through its own transform', () => {
    expect(newPath().bounds).toEqual({ l: 0, t: 0, r: 10, b: 2 });
    const { l, t, r, b } = newPath({ rotation: 90, pivotX: 5, pivotY: 1 }).bounds!;
    expect([l, t, r, b].map(n => Math.round(n * 1e6) / 1e6)).toEqual([4, -4, 6, 6]);
  });
});
