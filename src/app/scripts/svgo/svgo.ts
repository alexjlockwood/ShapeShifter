import { js2svg } from './lib/js2svg';
import { executePlugins } from './lib/plugins';
import { svg2js } from './lib/svg2js';
import { cleanupNumericValues } from './plugins/cleanupNumericValues';
import { collapseGroups } from './plugins/collapseGroups';
import { convertPathData } from './plugins/convertPathData';
import { convertShapeToPath } from './plugins/convertShapeToPath';
import { convertStyleToAttrs } from './plugins/convertStyleToAttrs';
import { convertTransforms } from './plugins/convertTransforms';
import { inlineStyles } from './plugins/inlineStyles';
import { mergePaths } from './plugins/mergePaths';
import { moveGroupAttrsToElems } from './plugins/moveGroupAttrsToElems';
import { removeComments } from './plugins/removeComments';
import { removeDoctype } from './plugins/removeDoctype';
import { removeEditorsNSData } from './plugins/removeEditorsNSData';
import { removeEmptyAttrs } from './plugins/removeEmptyAttrs';
import { removeEmptyContainers } from './plugins/removeEmptyContainers';
import { removeEmptyText } from './plugins/removeEmptyText';
import { removeHiddenElems } from './plugins/removeHiddenElems';
import { removeMetadata } from './plugins/removeMetadata';
import { removeNonInheritableGroupAttrs } from './plugins/removeNonInheritableGroupAttrs';
import { removeUnknownsAndDefaults } from './plugins/removeUnknownsAndDefaults';
import { removeUselessDefs } from './plugins/removeUselessDefs';
import { removeUselessStrokeAndFill } from './plugins/removeUselessStrokeAndFill';
import { replaceUseElems } from './plugins/replaceUseElems';

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
  replaceUseElems,
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
  svg2js(svgText, svgJs => {
    if (svgJs.error) {
      console.warn('Svgo failed to parse the specified SVG string', svgJs.error);
      callback(undefined);
      return;
    }
    callback(js2svg(executePlugins(svgJs, batchedSvgoPlugins), {
      indent: '  ',
      pretty: true,
    }).data);
  });
}
