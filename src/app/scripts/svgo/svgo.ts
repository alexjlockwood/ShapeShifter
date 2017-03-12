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

// The complete list is available here: https://github.com/svg/svgo/blob/master/.svgo.yml
const svgoPlugins = {
  removeDoctype,
  // removeXMLProcInst: require('svgo/plugins/removeXMLProcInst'),
  removeComments,
  removeMetadata,
  // removeXMLNS: require('svgo/plugins/removeXMLNS'), // disabled
  removeEditorsNSData,
  // cleanupAttrs: require('svgo/plugins/cleanupAttrs'),
  inlineStyles,
  // minifyStyles: require('svgo/plugins/minifyStyles'),
  convertStyleToAttrs,
  // replaceUseElems,
  // cleanupIDs: require('svgo/plugins/cleanupIDs'),
  // removeRasterImages: require('svgo/plugins/removeRasterImages'), // disabled
  removeUselessDefs,
  cleanupNumericValues,
  // cleanupListOfValues: require('svgo/plugins/cleanupListOfValues'),
  // convertColors: require('svgo/plugins/convertColors'),
  removeUnknownsAndDefaults,
  removeNonInheritableGroupAttrs,
  removeUselessStrokeAndFill,
  // removeViewBox: require('svgo/plugins/removeViewBox'), // disabled
  // cleanupEnableBackground: require('svgo/plugins/cleanupEnableBackground'),
  removeHiddenElems,
  removeEmptyText,
  convertShapeToPath,
  // moveElemsAttrsToGroup: require('svgo/plugins/moveElemsAttrsToGroup'),
  moveGroupAttrsToElems,
  collapseGroups,
  convertPathData,
  convertTransforms,
  removeEmptyAttrs,
  removeEmptyContainers,
  mergePaths,
  // removeUnusedNS: require('svgo/plugins/removeUnusedNS'),
  // transformsWithOnePath: require('svgo/plugins/transformsWithOnePath'), // disabled
  // sortAttrs: require('svgo/plugins/sortAttrs'),
  // removeTitle: require('svgo/plugins/removeTitle'), // disabled
  // removeDesc: require('svgo/plugins/removeDesc'),
  // removeDimensions: require('svgo/plugins/removeDimensions'), // disabled
  // removeAttrs: require('svgo/plugins/removeAttrs'), // disabled
  // removeElementsByAttr: require('svgo/plugins/removeElementsByAttr'), // disabled
  // addClassesToSVGElement: require('svgo/plugins/addClassesToSVGElement'), // disabled
  // removeStyleElement: require('svgo/plugins/removeStyleElement'), // disabled
  // addAttributesToSVGElement: require('svgo/plugins/addAttributesToSVGElement'), // disabled
};

// Create batches of svgo plugins to run in their optimal order.
// See also: https://github.com/svg/svgo/blob/master/docs/how-it-works/en.md#3-plugins
const batchedSvgoPlugins = (() => {
  let prevBatch;
  return Object.keys(svgoPlugins)
    .map(p => [svgoPlugins[p]])
    .filter(batch => {
      if (prevBatch && batch[0].type === prevBatch[0].type) {
        prevBatch.push(batch[0]);
        return false;
      }
      prevBatch = batch;
      return true;
    });
})();

export function optimize(svgText: string, callback: (optimizedSvgText: string) => void) {
  svgToJs(svgText, svgJs => {
    if (svgJs.error) {
      console.warn('Failed to parse the specified SVG string.');
      callback(svgText);
      return;
    }
    callback(jsToSvg(executePlugins(svgJs, batchedSvgoPlugins), {
      indent: '  ',
      pretty: true,
    }).data);
  });
}
