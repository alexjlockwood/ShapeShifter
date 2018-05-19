// TODO: find all differences between the svgo fork and svgo master (and create custom plugins for them?)
// TODO: test indirectly by testing the creation of the vector layer
// TODO: use promises as well for vector layer conversion
// TODO: make sure error handling works properly w/ the new promise architecture
// TODO: re-enable no implicit any and/or no implicit nulls?

import * as js2svg from 'svgo/lib/svgo/js2svg';
import * as executePlugins from 'svgo/lib/svgo/plugins';
import * as svg2js from 'svgo/lib/svgo/svg2js';
import * as cleanupAttrs from 'svgo/plugins/cleanupAttrs';
import * as cleanupIDs from 'svgo/plugins/cleanupIDs';
import * as cleanupNumericValues from 'svgo/plugins/cleanupNumericValues';
import * as collapseGroups from 'svgo/plugins/collapseGroups';
import * as convertPathData from 'svgo/plugins/convertPathData';
import * as convertShapeToPath from 'svgo/plugins/convertShapeToPath';
import * as convertStyleToAttrs from 'svgo/plugins/convertStyleToAttrs';
import * as convertTransform from 'svgo/plugins/convertTransform';
import * as inlineStyles from 'svgo/plugins/inlineStyles';
import * as mergePaths from 'svgo/plugins/mergePaths';
import * as minifyStyles from 'svgo/plugins/minifyStyles';
import * as moveElemsAttrsToGroup from 'svgo/plugins/moveElemsAttrsToGroup';
import * as moveGroupAttrsToElems from 'svgo/plugins/moveGroupAttrsToElems';
import * as removeComments from 'svgo/plugins/removeComments';
import * as removeDesc from 'svgo/plugins/removeDesc';
import * as removeDoctype from 'svgo/plugins/removeDoctype';
import * as removeEditorsNSData from 'svgo/plugins/removeEditorsNSData';
import * as removeEmptyAttrs from 'svgo/plugins/removeEmptyAttrs';
import * as removeEmptyContainers from 'svgo/plugins/removeEmptyContainers';
import * as removeEmptyText from 'svgo/plugins/removeEmptyText';
import * as removeHiddenElems from 'svgo/plugins/removeHiddenElems';
import * as removeMetadata from 'svgo/plugins/removeMetadata';
import * as removeNonInheritableGroupAttrs from 'svgo/plugins/removeNonInheritableGroupAttrs';
import * as removeRasterImages from 'svgo/plugins/removeRasterImages';
import * as removeScriptElement from 'svgo/plugins/removeScriptElement';
import * as removeStyleElement from 'svgo/plugins/removeStyleElement';
import * as removeTitle from 'svgo/plugins/removeTitle';
import * as removeUnknownsAndDefaults from 'svgo/plugins/removeUnknownsAndDefaults';
import * as removeUselessDefs from 'svgo/plugins/removeUselessDefs';
import * as removeUselessStrokeAndFill from 'svgo/plugins/removeUselessStrokeAndFill';
import * as removeXMLProcInst from 'svgo/plugins/removeXMLProcInst';

// Custom plugins.
import { convertRoundedRectToPath } from './plugins/convertRoundedRectToPath';
import { replaceUseElems } from './plugins/replaceUseElems';

// The complete list is available here: https://github.com/svg/svgo/blob/master/.svgo.yml
const pluginsData = {
  removeDoctype,
  removeXMLProcInst,
  removeComments,
  removeMetadata,
  // removeXMLNS,
  removeEditorsNSData,
  cleanupAttrs,
  inlineStyles,
  minifyStyles,
  convertStyleToAttrs,
  cleanupIDs,
  // prefixIds,
  removeRasterImages,
  removeUselessDefs,
  replaceUseElems,
  cleanupNumericValues,
  // cleanupListOfValues,
  // convertColors,
  removeUnknownsAndDefaults,
  removeNonInheritableGroupAttrs,
  removeUselessStrokeAndFill,
  // removeViewBox,
  // cleanupEnableBackground,
  removeHiddenElems,
  removeEmptyText,
  convertShapeToPath,
  convertRoundedRectToPath,
  moveElemsAttrsToGroup,
  moveGroupAttrsToElems,
  collapseGroups,
  convertPathData,
  convertTransform,
  removeEmptyAttrs,
  removeEmptyContainers,
  mergePaths,
  // removeUnusedNS,
  // sortAttrs,
  removeTitle,
  removeDesc,
  // removeDimensions
  // removeAttrs,
  // removeElementsByAttr,
  // addClassesToSVGElement,
  removeStyleElement,
  removeScriptElement,
  // addAttributesToSVGElement,
};

// Set a global floatPrecision across all the plugins.
const floatPrecision = 6;
for (const plugin of Object.values(pluginsData)) {
  if (plugin.params && 'floatPrecision' in plugin.params) {
    plugin.params.floatPrecision = floatPrecision;
  }
}

// Tweak plugin params.
cleanupIDs.params.minify = false;
convertPathData.params.makeArcs = undefined;
convertPathData.params.transformPrecision = floatPrecision;
convertShapeToPath.params.convertArcs = true;
convertTransform.params.transformPrecision = floatPrecision;
inlineStyles.params.onlyMatchedOnce = false;
removeUselessStrokeAndFill.params.removeNone = true;

const optimizedPluginsData = (function () {
  return Object.values(pluginsData)
    .map(item => [item])
    .reduce((arr, item) => {
      const last = arr[arr.length - 1];
      if (last && item[0].type === last[0].type) {
        last.push(item[0]);
      } else {
        arr.push(item);
      }
      return arr;
    }, []);
})();

export function optimizeSvg(svgText: string, pretty = true): Promise<string> {
  return new Promise((resolve, reject) => {
    const callbackFn = (svgjs: any) => {
      if (svgjs.error) {
        reject(svgjs.error);
        return;
      }
      resolve(svgjs.data);
    };
    svg2js(svgText, (svgjs: any) => {
      if (svgjs.error) {
        callbackFn(svgjs);
        return;
      }
      svgjs = executePlugins(svgjs, { input: 'string' }, optimizedPluginsData);
      callbackFn(
        js2svg(svgjs, {
          indent: '  ',
          pretty,
        }),
      );
    });
  });
}
