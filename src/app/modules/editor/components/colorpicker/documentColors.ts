import { LayerUtil, PathLayer, type VectorLayer } from 'app/modules/editor/model/layers';
import { Animation, ColorAnimationBlock } from 'app/modules/editor/model/timeline';

/**
 * Collects every distinct color used in the document, for the color picker's "In this document"
 * swatches: the vector layer's canvas color, every path layer's fill and stroke colors, and every
 * color block's from and to values. `''` (no color) is left out. The result keeps the order each
 * color first appears in (the vector layer, then a preorder walk of its layers, then the blocks),
 * so the swatches don't reorder themselves as the document is edited.
 */
export function collectDocumentColors(vl: VectorLayer, animation: Animation): string[] {
  const colors: string[] = [];
  const seen = new Set<string>();
  const add = (color: string | undefined) => {
    if (color && !seen.has(color)) {
      seen.add(color);
      colors.push(color);
    }
  };
  add(vl.canvasColor);
  for (const layer of LayerUtil.runPreorderTraversal(vl)) {
    if (layer instanceof PathLayer) {
      add(layer.fillColor);
      add(layer.strokeColor);
    }
  }
  for (const block of animation.blocks) {
    if (block instanceof ColorAnimationBlock) {
      add(block.fromValue);
      add(block.toValue);
    }
  }
  return colors;
}
