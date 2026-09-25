import { loadVectorLayerFromSvgStringInternal } from 'app/modules/editor/scripts/import/SvgLoader';
import goldens from 'test/fixtures/svgo/legacy-outputs.json';

import { optimizeSvg } from '.';

// Compares the layers imported through svgo 4 with those imported through the svgo 1.x
// outputs captured in legacy-outputs.json before the upgrade. Layer ids are regenerated on
// each import, and path coordinates are rounded to absorb floating point noise.
//
// The svgo 1.x outputs were captured with noSpaceAfterFlags disabled (in both convertPathData and
// mergePaths). By default svgo 1.x wrote compact arc flags (e.g. 'a10 10 0 100 20'), which
// PathParser misreads, so circles and rounded rects used to import with the wrong geometry. They
// were also captured with cleanupIDs' remove param disabled, matching the svgo 4 pipeline, which
// keeps ids so that layers are named after them.
function toComparableJson(svg: string) {
  const vl = loadVectorLayerFromSvgStringInternal(svg, () => false)!;
  return JSON.parse(JSON.stringify(vl.toJSON()), (key, value) => {
    if (key === 'id') {
      return undefined;
    }
    if (key === 'pathData' && typeof value === 'string') {
      return value.replace(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi, n => `${Math.round(+n * 1000) / 1000}`);
    }
    return value;
  });
}

describe('optimizeSvg', () => {
  for (const [name, { input, output }] of Object.entries(goldens)) {
    it(`imports ${name} the same as svgo 1.x`, async () => {
      const actual = toComparableJson(await optimizeSvg(input));
      expect(actual).toEqual(toComparableJson(output));
    });
  }

  it('rejects malformed SVG', async () => {
    await expect(optimizeSvg('<svg><g></svg>')).rejects.toThrow();
  });
});
