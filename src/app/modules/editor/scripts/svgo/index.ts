import { optimize, type PluginConfig } from 'svgo/browser';

import { convertRoundedRectToPath } from './plugins/convertRoundedRectToPath';
import { replaceUseElems } from './plugins/replaceUseElems';

const floatPrecision = 6;

// The complete list is available here: https://svgo.dev/docs/plugins/
// The order matters, as each plugin is run in sequence.
const plugins: PluginConfig[] = [
  'removeDoctype',
  'removeXMLProcInst',
  'removeComments',
  'removeMetadata',
  // 'removeXMLNS',
  'removeEditorsNSData',
  'cleanupAttrs',
  { name: 'inlineStyles', params: { onlyMatchedOnce: false } },
  'minifyStyles',
  'convertStyleToAttrs',
  // SvgLoader names the imported layers after their ids.
  { name: 'cleanupIds', params: { remove: false, minify: false } },
  // 'prefixIds',
  'removeRasterImages',
  'removeUselessDefs',
  replaceUseElems,
  'cleanupNumericValues',
  // 'cleanupListOfValues',
  // 'convertColors',
  'removeUnknownsAndDefaults',
  'removeNonInheritableGroupAttrs',
  { name: 'removeUselessStrokeAndFill', params: { removeNone: true } },
  // 'removeViewBox',
  // 'cleanupEnableBackground',
  'removeHiddenElems',
  'removeEmptyText',
  { name: 'convertShapeToPath', params: { convertArcs: true } },
  convertRoundedRectToPath,
  'moveElemsAttrsToGroup',
  'moveGroupAttrsToElems',
  'collapseGroups',
  {
    name: 'convertPathData',
    params: {
      // svgo falls back to its default when this is undefined, so pass null to disable
      // converting curves to arcs.
      makeArcs: null as unknown as undefined,
      // These didn't exist in svgo 1.x, and they change the number and type of commands,
      // which the user relies on when making paths morphable.
      convertToQ: false,
      convertToZ: false,
      // This also drops closepath commands, which would leave closed subpaths open.
      // SvgLoader removes the zero-length segments instead.
      removeUseless: false,
      transformPrecision: floatPrecision,
    },
  },
  { name: 'convertTransform', params: { transformPrecision: floatPrecision } },
  'removeEmptyAttrs',
  'removeEmptyContainers',
  'mergePaths',
  // 'removeUnusedNS',
  // 'sortAttrs',
  'removeTitle',
  'removeDesc',
  // 'removeDimensions',
  // 'removeAttrs',
  // 'removeElementsByAttr',
  // 'addClassesToSVGElement',
  'removeStyleElement',
  'removeScripts',
  // 'addAttributesToSVGElement',
];

export function optimizeSvg(svgText: string, pretty = true): Promise<string> {
  return new Promise(resolve => {
    const { data } = optimize(svgText, {
      floatPrecision,
      plugins,
      js2svg: { indent: 2, pretty },
    });
    resolve(data);
  });
}
