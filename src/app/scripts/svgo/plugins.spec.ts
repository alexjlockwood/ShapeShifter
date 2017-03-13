import 'jasmine';
import { svgToJs } from './lib/svg2js';
import { jsToSvg } from './lib/js2svg';
import { executePlugins } from './lib/plugins';
import { inlineStyles } from './plugins/inlineStyles';
import { convertStyleToAttrs } from './plugins/convertStyleToAttrs';
import { moveGroupAttrsToElems } from './plugins/moveGroupAttrsToElems';
import { convertPathData } from './plugins/convertPathData';
import { mergePaths } from './plugins/mergePaths';
import { removeDoctype } from './plugins/removeDoctype';
import { collapseGroups } from './plugins/collapseGroups';
import { convertShapeToPath } from './plugins/convertShapeToPath';
import { removeEmptyContainers } from './plugins/removeEmptyContainers';
import { removeHiddenElems } from './plugins/removeHiddenElems';
import { removeUselessDefs } from './plugins/removeUselessDefs';
import { removeEditorsNSData } from './plugins/removeEditorsNSData';
import { cleanupNumericValues } from './plugins/cleanupNumericValues';
import { convertTransforms } from './plugins/convertTransforms';
import { removeComments } from './plugins/removeComments';
import { removeMetadata } from './plugins/removeMetadata';
import { removeUnknownsAndDefaults } from './plugins/removeUnknownsAndDefaults';
import { removeEmptyText } from './plugins/removeEmptyText';
import { removeEmptyAttrs } from './plugins/removeEmptyAttrs';
import { removeNonInheritableGroupAttrs } from './plugins/removeNonInheritableGroupAttrs';
import { replaceUseElems } from './plugins/replaceUseElems';
import { removeUselessStrokeAndFill } from './plugins/removeUselessStrokeAndFill';

describe('SVGO plugins', function () {

  it('removeDoctype', () => {
    runTest(removeDoctype, `
<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">
<svg xmlns="http://www.w3.org/2000/svg">
    test
</svg>
`, `
<svg xmlns="http://www.w3.org/2000/svg">
    test
</svg>
`);
  });

  it('convertPathData', () => {
    runTest(convertPathData, `
<svg xmlns="http://www.w3.org/2000/svg">
    <path d="m100,200 300,400 z m100,200 L 300,400"/>
</svg>
`, `
<svg xmlns="http://www.w3.org/2000/svg">
    <path d="M100 200l300 400zm100 200h100"/>
</svg>
`);
    runTest(convertPathData, `
<svg xmlns="http://www.w3.org/2000/svg">
    <path d="M 10,50 L 20,30"/>
    <path d="M 10,50 C 20,30 40,50 60,70"/>
    <path d="M 10,50 C 20,30 40,50 60,70 S 20,30 30,60"/>
    <path d="M 10,50 Q 30,60 30,70"/>
    <path d="M 10,50 Q 30,60 30,70 T 40,70"/>
    <path d="M 10,50 A 20,60 45 0,1 40,70"/>
</svg>
`, `
<svg xmlns="http://www.w3.org/2000/svg">
    <path d="M10 50l10-20"/>
    <path d="M10 50c10-20 30 0 50 20"/>
    <path d="M10 50c10-20 30 0 50 20S20 30 30 60"/>
    <path d="M10 50q20 10 20 20"/>
    <path d="M10 50q20 10 20 20t10 0"/>
    <path d="M10 50a20 60 45 0 1 30 20"/>
</svg>
`);
  });
});

function runTest(plugin, svgText: string, expectedSvgText: string) {
  optimize(svgText, plugin, optimized => {
    expect(optimized.trim()).toEqual(expectedSvgText.trim());
  });
}

const batchedSvgoPlugins = plugin => {
  let prevBatch;
  return Object.keys({ plugin })
    .map(p => [{ plugin }[p]])
    .filter(batch => {
      if (prevBatch && batch[0].type === prevBatch[0].type) {
        prevBatch.push(batch[0]);
        return false;
      }
      prevBatch = batch;
      return true;
    });
};

function optimize(svgText: string, plugin, callback: (optimizedSvgText: string) => void) {
  svgToJs(svgText, svgJs => {
    if (svgJs.error) {
      console.warn('Failed to parse the specified SVG string.');
      callback(svgText);
      return;
    }
    callback(jsToSvg(executePlugins(svgJs, batchedSvgoPlugins(plugin)), {
      indent: '    ',
      pretty: true,
    }).data);
  });
}
