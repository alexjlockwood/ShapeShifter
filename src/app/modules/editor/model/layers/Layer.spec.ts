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
    expect(layer.pathData.getPathString()).toBe('M 0 0 L 10 10');
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
    const property = layer.inspectableProperties.get('strokeLinejoin');
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
    const property = layer.inspectableProperties.get('fillColor');
    property.setEditableValue(layer, 'fillColor', 'none');
    expect(layer.fillColor).toBe('');
    property.setEditableValue(layer, 'fillColor', 'blue');
    expect(layer.fillColor).toBe('#0000ff');
  });
});
