import { PathLayer, VectorLayer } from 'app/modules/editor/model/layers';
import { Path } from 'app/modules/editor/model/paths';
import { Animation, AnimationBlock } from 'app/modules/editor/model/timeline';

import { AvdSerializer } from '.';

describe('AvdSerializer', () => {
  function toAvdXml(block: AnimationBlock, layer: PathLayer) {
    const vl = new VectorLayer({ name: 'vector', children: [layer] });
    const animation = new Animation({ duration: 300 });
    animation.blocks = [block];
    return AvdSerializer.toAnimatedVectorDrawableXmlString(vl, animation);
  }

  it('leaves out color values that have been cleared', () => {
    const layer = new PathLayer({
      name: 'path',
      children: [],
      pathData: new Path('M 0 0 L 10 10'),
      fillColor: '#000000',
    });
    const block = AnimationBlock.from({
      type: 'color',
      layerId: layer.id,
      propertyName: 'fillColor',
      fromValue: '#ff0000',
      toValue: '#00ff00',
    });
    // This is what the property panel does when the text field is cleared.
    block.inspectableProperties.get('fromValue')!.setEditableValue(block, 'fromValue', '');

    const xml = toAvdXml(block, layer);
    expect(xml).not.toContain('android:valueFrom');
    expect(xml).toContain('android:valueTo="#00ff00"');
    expect(xml).toContain('android:valueType="colorType"');
  });

  describe('interpolators', () => {
    function toXml(interpolator: string) {
      const layer = new PathLayer({
        name: 'path',
        children: [],
        pathData: new Path('M 0 0 L 10 10'),
        fillColor: '#000000',
      });
      const block = AnimationBlock.from({
        type: 'number',
        layerId: layer.id,
        propertyName: 'fillAlpha',
        fromValue: 0,
        toValue: 1,
        interpolator,
      });
      return toAvdXml(block, layer);
    }

    function parseXml(xml: string) {
      return new DOMParser().parseFromString(xml, 'application/xml');
    }

    it('refers to a preset by its Android resource', () => {
      const xml = toXml('LINEAR');
      expect(xml).toContain('android:interpolator="@android:anim/linear_interpolator"');
      expect(xml).not.toContain('pathInterpolator');
    });

    it('writes a single cubic as a pathInterpolator with control points', () => {
      const xml = toXml('M 0 0 C 0.3 -0.2 0.2 1.3 1 1');
      const doc = parseXml(xml);
      expect(doc.querySelector('parsererror')).toBeNull();
      const animator = doc.getElementsByTagName('objectAnimator')[0];
      expect(animator.hasAttribute('android:interpolator')).toBe(false);
      const attr = animator.getElementsByTagNameNS('http://schemas.android.com/aapt', 'attr')[0];
      expect(attr.getAttribute('name')).toBe('android:interpolator');
      const pathInterpolator = attr.getElementsByTagName('pathInterpolator')[0];
      const android = 'http://schemas.android.com/apk/res/android';
      expect(pathInterpolator.getAttributeNS(android, 'controlX1')).toBe('0.3');
      expect(pathInterpolator.getAttributeNS(android, 'controlY1')).toBe('-0.2');
      expect(pathInterpolator.getAttributeNS(android, 'controlX2')).toBe('0.2');
      expect(pathInterpolator.getAttributeNS(android, 'controlY2')).toBe('1.3');
      expect(pathInterpolator.hasAttributeNS(android, 'pathData')).toBe(false);
      // The root declares the aapt namespace that the inline interpolator uses.
      expect(doc.documentElement.getAttribute('xmlns:aapt')).toBe(
        'http://schemas.android.com/aapt',
      );
    });

    it('writes several segments as a pathInterpolator with path data', () => {
      const curve = 'M 0 0 C 0.2 0 0 1.4 0.5 1.2 C 0.8 1 0.9 1 1 1';
      const doc = parseXml(toXml(curve));
      expect(doc.querySelector('parsererror')).toBeNull();
      const animator = doc.getElementsByTagName('objectAnimator')[0];
      expect(animator.hasAttribute('android:interpolator')).toBe(false);
      const pathInterpolator = animator.getElementsByTagName('pathInterpolator')[0];
      const android = 'http://schemas.android.com/apk/res/android';
      expect(pathInterpolator.getAttributeNS(android, 'pathData')).toBe(curve);
      expect(pathInterpolator.hasAttributeNS(android, 'controlX1')).toBe(false);
    });
  });

  describe('transforms on paths', () => {
    const android = 'http://schemas.android.com/apk/res/android';

    function rotatedPath() {
      return new PathLayer({
        name: 'arrow',
        children: [],
        pathData: new Path('M 0 0 L 10 10'),
        fillColor: '#000000',
        rotation: 30,
        pivotX: 12,
        pivotY: 12,
      });
    }

    it('wraps a transformed path in a group, since paths have no transform', () => {
      const vl = new VectorLayer({ name: 'vector', children: [rotatedPath()] });
      const doc = new DOMParser().parseFromString(
        AvdSerializer.toVectorDrawableXmlString(vl),
        'application/xml',
      );
      const group = doc.getElementsByTagName('group')[0];
      expect(group.getAttributeNS(android, 'name')).toBe('arrow_transform');
      expect(group.getAttributeNS(android, 'rotation')).toBe('30');
      expect(group.getAttributeNS(android, 'pivotX')).toBe('12');
      const path = group.getElementsByTagName('path')[0];
      expect(path.getAttributeNS(android, 'name')).toBe('arrow');
      expect(path.hasAttributeNS(android, 'rotation')).toBe(false);
    });

    it("targets the group with the path's transform animations, and the path with its others", () => {
      const layer = rotatedPath();
      const vl = new VectorLayer({ name: 'vector', children: [layer] });
      const animation = new Animation({ duration: 300 });
      animation.blocks = [
        AnimationBlock.from({
          type: 'number',
          layerId: layer.id,
          propertyName: 'rotation',
          fromValue: 30,
          toValue: 90,
        }),
        AnimationBlock.from({
          type: 'number',
          layerId: layer.id,
          propertyName: 'fillAlpha',
          fromValue: 0,
          toValue: 1,
        }),
      ];
      const doc = new DOMParser().parseFromString(
        AvdSerializer.toAnimatedVectorDrawableXmlString(vl, animation),
        'application/xml',
      );
      const targets = Array.from(doc.getElementsByTagName('target')).map(target => [
        target.getAttributeNS(android, 'name'),
        Array.from(target.getElementsByTagName('objectAnimator')).map(a =>
          a.getAttributeNS(android, 'propertyName'),
        ),
      ]);
      expect(targets).toEqual(
        expect.arrayContaining([
          ['arrow_transform', ['rotation']],
          ['arrow', ['fillAlpha']],
        ]),
      );
      expect(targets.length).toBe(2);
    });
  });
});
