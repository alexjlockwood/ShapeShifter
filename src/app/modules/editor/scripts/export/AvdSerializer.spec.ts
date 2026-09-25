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
});
