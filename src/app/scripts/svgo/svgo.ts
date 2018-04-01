// TODO: tweak the plugin params so that they match the current customized values
// TODO: create a custom plugin to convert rounded rectangles appropriately
// TODO: find all differences between the svgo fork and svgo master (and create custom plugins for them?)
// TODO: test indirectly by testing the creation of the vector layer
// TODO: use promises as well for vector layer conversion
// TODO: make sure error handling works properly w/ the new promise architecture
// TODO: comment out unused plugins below
// TODO: re-enable no implicit any and/or no implicit nulls?
import * as js2svg from 'svgo/lib/svgo/js2svg';
import * as executePlugins from 'svgo/lib/svgo/plugins';
import * as svg2js from 'svgo/lib/svgo/svg2js';
import * as cleanupAttrs from 'svgo/plugins/cleanupAttrs';
import * as cleanupEnableBackground from 'svgo/plugins/cleanupEnableBackground';
import * as cleanupIDs from 'svgo/plugins/cleanupIDs';
import * as cleanupListOfValues from 'svgo/plugins/cleanupListOfValues';
import * as cleanupNumericValues from 'svgo/plugins/cleanupNumericValues';
import * as collapseGroups from 'svgo/plugins/collapseGroups';
import * as convertColors from 'svgo/plugins/convertColors';
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
import * as removeDimensions from 'svgo/plugins/removeDimensions';
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
import * as removeUnusedNS from 'svgo/plugins/removeUnusedNS';
import * as removeUselessDefs from 'svgo/plugins/removeUselessDefs';
import * as removeUselessStrokeAndFill from 'svgo/plugins/removeUselessStrokeAndFill';
import * as removeViewBox from 'svgo/plugins/removeViewBox';
import * as removeXMLNS from 'svgo/plugins/removeXMLNS';
import * as removeXMLProcInst from 'svgo/plugins/removeXMLProcInst';
import * as sortAttrs from 'svgo/plugins/sortAttrs';

// Custom plugins.
import { replaceUseElems } from './plugins/replaceUseElems';

// The complete list is available here: https://github.com/svg/svgo/blob/master/.svgo.yml
const pluginsData = {
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
  convertTransform,
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

function optimizePluginsArray(rawPlugins) {
  return rawPlugins.map(item => [item]).reduce((arr, item) => {
    const last = arr[arr.length - 1];
    if (last && item[0].type === last[0].type) {
      last.push(item[0]);
    } else {
      arr.push(item);
    }
    return arr;
  }, []);
}

const optimisedPluginsData = optimizePluginsArray(Object.values(pluginsData));

export function optimize(svgText: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const callbackFn = svgjs => {
      if (svgjs.error) {
        reject(svgjs.error);
        return;
      }
      resolve(svgjs.data);
    };
    svg2js(svgText, svgjs => {
      if (svgjs.error) {
        callbackFn(svgjs);
        return;
      }
      svgjs = executePlugins(svgjs, { input: 'string' }, optimisedPluginsData);
      callbackFn(
        js2svg(svgjs, {
          indent: '  ',
          pretty: true,
        }),
      );
    });
  });
}
