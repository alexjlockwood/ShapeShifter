import { LayerUtil, PathLayer, VectorLayer } from 'app/modules/editor/model/layers';
import { Path } from 'app/modules/editor/model/paths';
import { Animation, AnimationBlock } from 'app/modules/editor/model/timeline';
import { MathUtil } from 'app/modules/editor/scripts/common';
import { SvgLoader, VectorDrawableLoader } from 'app/modules/editor/scripts/import';
import { describe, expect, it } from 'vitest';

import { AvdSerializer, SvgSerializer } from '.';

// A rotated, scaled, and moved path survives exporting and importing it again. The imported file
// has a group around the path (from the AnimatedVectorDrawable), or the transform baked into its
// path (from the SVG), which is expected, so this compares where the points are drawn rather than
// the layers.

function newDocument() {
  const path = new PathLayer({
    name: 'arrow',
    children: [],
    pathData: new Path('M 4 4 L 14 4 L 14 8 Z'),
    fillColor: '#000000',
    rotation: 30,
    scaleX: 1.5,
    scaleY: 0.5,
    pivotX: 12,
    pivotY: 12,
    translateX: 2,
  });
  const vl = new VectorLayer({ name: 'vector', children: [path], width: 24, height: 24 });
  const animation = new Animation({ duration: 300 });
  animation.blocks = [
    AnimationBlock.from({
      type: 'number',
      layerId: path.id,
      propertyName: 'rotation',
      fromValue: 30,
      toValue: 90,
    }),
  ];
  return { vl, animation };
}

/** The points of every path, where they're drawn, rounded to 3 decimals. */
function drawnPoints(vl: VectorLayer) {
  return LayerUtil.runPreorderTraversal(vl)
    .filter(layer => layer instanceof PathLayer)
    .flatMap(layer => {
      const matrix = LayerUtil.getCanvasTransformForLayer(vl, layer.id);
      return (layer.pathData?.getCommands() ?? []).map(command => {
        const { x, y } = MathUtil.transformPoint(command.end, matrix);
        return [Math.round(x * 1e3) / 1e3, Math.round(y * 1e3) / 1e3];
      });
    });
}

describe('exporting transformed paths', () => {
  it('round trips through an AnimatedVectorDrawable', () => {
    const { vl, animation } = newDocument();
    const avd = AvdSerializer.toAnimatedVectorDrawableXmlString(vl, animation);
    const doc = new DOMParser().parseFromString(avd, 'application/xml');
    const vector = doc.getElementsByTagName('vector')[0];
    const imported = VectorDrawableLoader.loadVectorLayerFromXmlString(
      new XMLSerializer().serializeToString(vector),
      () => false,
    );
    expect(imported).toBeDefined();
    expect(imported!.children[0].name).toBe('arrow_transform');
    expect(drawnPoints(imported!)).toEqual(drawnPoints(vl));
  });

  it('round trips through an SVG', async () => {
    const { vl } = newDocument();
    const imported = await SvgLoader.loadVectorLayerFromSvgString(
      SvgSerializer.toSvgString(vl),
      () => false,
    );
    const expected = drawnPoints(vl);
    const actual = drawnPoints(imported);
    // SVGO may drop the closing segment, which goes back to the first point anyway.
    expect(actual.slice(0, 3)).toEqual(expected.slice(0, 3));
  });
});
