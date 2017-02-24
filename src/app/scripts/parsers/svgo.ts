import * as specificity from 'specificity';
import * as stable from 'stable';
import * as csso from 'csso';
import { svgToJs } from './svg2js';
import { jsToSvg } from './js2svg';
import * as EXTEND from 'whet.extend';

export function optimize(svgText, callback) {
  svgToJs(svgText, svgJs => {
    if (svgJs.error) {
      console.warn('Failed to parse the specified SVG string.');
      callback(svgText);
      return;
    }
    let data = inlineStyles(svgJs);
    data = perItem(data, [convertStyleToAttrs]);
    callback(jsToSvg(data, {
      indent: '  ',
      pretty: true,
    }).data);
  });
}

/**
 * Direct or reverse per-item loop.
 *
 * @param {Object} data input data
 * @param {Array} plugins plugins list to process
 * @param {Boolean} [reverse] reverse pass?
 * @return {Object} output data
 */
function perItem(data, plugins, reverse = false) {
  function monkeys(items) {
    items.content = items.content.filter(function (item) {

      // reverse pass
      if (reverse && item.content) {
        monkeys(item);
      }

      // main filter
      var filter = true;

      for (var i = 0; filter && i < plugins.length; i++) {
        var plugin = plugins[i];

        if (/*plugin.active && */plugin(item/*, plugin.params*/) === false) {
          filter = false;
        }
      }

      // direct pass
      if (!reverse && item.content) {
        monkeys(item);
      }

      return filter;

    });

    return items;
  }
  return monkeys(data);
}

/**
  * Moves + merges styles from style elements to element styles
  *
  * Options
  *   onlyMatchedOnce (default: true)
  *     inline only selectors that match once
  *
  *   removeMatchedSelectors (default: true)
  *     clean up matched selectors,
  *     leave selectors that hadn't matched
  *
  *   useMqs (default: ['screen'])
  *     what mediaqueries to be used,
  *     non-mediaquery styles are always used
  *
  *   usePseudoClasses (default: [])
  *     what pseudo-classes to be used,
  *     non-pseudo-class styles are always used
  *
  * @param {Object} root (document)
  * @param {Object} params plugin params
  *
  * @author strarsis <strarsis@gmail.com>
  */
function inlineStyles(
  document,
  onlyMatchedOnce = false,
  removeMatchedSelectors = true,
  useMqs = ['screen'],
  usePseudoClasses = []) {

  // collect <style/>s
  var styleEls = document.querySelectorAll('style');

  var styleItems = [],
    selectorItems = [];
  for (var styleElIndex in styleEls) {
    var styleEl = styleEls[styleElIndex];

    if (styleEl.isEmpty()) {
      // skip empty <style/>s
      continue;
    }
    var cssStr = styleEl.content[0].text || styleEl.content[0].cdata || [];

    // collect <style/>s and their css ast
    var cssAst = csso.parse(cssStr, { context: 'stylesheet' });
    styleItems.push({
      styleEl: styleEl,
      cssAst: cssAst
    });

    // collect css selectors and their containing ruleset
    var curAtruleExpNode = null,
      curPseudoClassItem = null,
      curPseudoClassList = null;
    csso.walk(cssAst, function (node, item, list) {

      // media query blocks
      // "look-behind the SimpleSelector", AtruleExpression node comes _before_ the affected SimpleSelector
      if (node.type === 'AtruleExpression') { // marks the beginning of an Atrule
        curAtruleExpNode = node;
      }
      // "look-ahead the SimpleSelector", Atrule node comes _after_ the affected SimpleSelector
      if (node.type === 'Atrule') { // marks the end of an Atrule
        curAtruleExpNode = null;
      }

      // Pseudo classes
      // "look-behind the SimpleSelector", PseudoClass node comes _before_ the affected SimpleSelector
      if (node.type === 'PseudoClass') {
        curPseudoClassItem = item;
        curPseudoClassList = list;
      }

      if (node.type === 'SimpleSelector') {
        // csso 'SimpleSelector' to be interpreted with CSS2.1 specs, _not_ with CSS3 Selector module specs:
        // Selector group ('Selector' in csso) consisting of simple selectors ('SimpleSelector' in csso), separated by comma.
        // <Selector>: <'SimpleSelector'>, <'SimpleSelector'>, ...

        var curSelectorItem = {
          simpleSelectorItem: item,
          rulesetNode: this.ruleset,
          atRuleExpNode: curAtruleExpNode,

          pseudoClassItem: curPseudoClassItem,
          pseudoClassList: curPseudoClassList
        };
        selectorItems.push(curSelectorItem);

        // pseudo class scope ends with the SimpleSelector
        curPseudoClassItem = null;
        curPseudoClassList = null;
      }

    });
  }

  // filter for mediaqueries to be used or without any mediaquery
  var selectorItemsMqs = selectorItems.filter(function (selectorItem) {
    if (selectorItem.atRuleExpNode === null) {
      return true;
    }
    var mqStr = csso.translate(selectorItem.atRuleExpNode);
    return useMqs.indexOf(mqStr) > -1;
  });

  // filter for pseudo classes to be used or not using a pseudo class
  var selectorItemsPseudoClasses = selectorItemsMqs.filter(function (selectorItem) {
    return (selectorItem.pseudoClassItem === null ||
      usePseudoClasses.indexOf(selectorItem.pseudoClassItem.data.name) > -1);
  });

  // remove PseudoClass from its SimpleSelector for proper matching
  selectorItemsPseudoClasses.map(function (selectorItem) {
    if (selectorItem.pseudoClassItem === null) {
      return;
    }
    selectorItem.pseudoClassList.remove(selectorItem.pseudoClassItem);
  });

  // compile css selector strings
  selectorItemsPseudoClasses.map(function (selectorItem) {
    selectorItem.selectorStr = csso.translate(selectorItem.simpleSelectorItem.data);
  });

  // stable-sort css selectors by their specificity
  var selectorItemsSorted = stable(selectorItemsPseudoClasses, function (itemA, itemB) {
    return specificity.compare(itemA.selectorStr, itemB.selectorStr);
  }).reverse(); // last declaration applies last (final)

  // apply <style/> styles to matched elements
  for (var selectorItemIndex in selectorItemsSorted) {
    var selectorItem = selectorItemsSorted[selectorItemIndex],

      selectedEls = document.querySelectorAll(selectorItem.selectorStr);
    if (onlyMatchedOnce && selectedEls !== null && selectedEls.length > 1) {
      // skip selectors that match more than once if option onlyMatchedOnce is enabled
      continue;
    }

    for (var selectedElIndex in selectedEls) {
      var selectedEl = selectedEls[selectedElIndex];

      // empty defaults in case there is no style attribute
      var elInlineStyleAttr = { name: 'style', value: '', prefix: '', local: 'style' },
        elInlineStyles = '';

      if (selectedEl.hasAttr('style')) {
        elInlineStyleAttr = selectedEl.attr('style');
        elInlineStyles = elInlineStyleAttr.value;
      }
      var inlineCssAst = csso.parse(elInlineStyles, { context: 'block' });

      // merge element(inline) styles + matching <style/> styles
      var newInlineCssAst = csso.parse('', { context: 'block' }); // for an empty css ast (in block context)

      var mergedDeclarations = [];
      var _fetchDeclarations = function (node, item) {
        if (node.type === 'Declaration') {
          mergedDeclarations.push(item);
        }
      };
      var itemRulesetNodeCloned = csso.clone(selectorItem.rulesetNode);
      // clone to prevent leaking declaration references (csso.translate(...))
      csso.walk(itemRulesetNodeCloned, _fetchDeclarations);
      csso.walk(inlineCssAst, _fetchDeclarations);

      // sort by !important(ce)
      var mergedDeclarationsSorted = stable(mergedDeclarations, function (declarationA, declarationB) {
        var declarationAScore = ~~declarationA.data.value.important, // (cast boolean to number)
          declarationBScore = ~~declarationB.data.value.important; //  "
        return (declarationAScore - declarationBScore);
      });

      // to css
      for (var mergedDeclarationsSortedIndex in mergedDeclarationsSorted) {
        var declaration = mergedDeclarationsSorted[mergedDeclarationsSortedIndex];
        newInlineCssAst.declarations.insert(declaration);
      }
      var newCss = csso.translate(newInlineCssAst);

      elInlineStyleAttr.value = newCss;
      selectedEl.addAttr(elInlineStyleAttr);
    }

    if (removeMatchedSelectors && selectedEls !== null && selectedEls.length > 0) {
      // clean up matching simple selectors if option removeMatchedSelectors is enabled
      selectorItem.rulesetNode.selector.selectors.remove(selectorItem.simpleSelectorItem);
    }
  }

  var styleItemIndex: any = 0,
    styleItem: any = {};
  for (styleItemIndex in styleItems) {
    styleItem = styleItems[styleItemIndex];

    csso.walk(styleItem.cssAst, function (node, item, list) {
      // clean up <style/> atrules without any rulesets left
      if (node.type === 'Atrule' &&
        // only Atrules containing rulesets
        node.block !== null &&
        typeof node.block.rules !== 'undefined' &&
        node.block.rules.isEmpty()) {
        list.remove(item);
      }

      // clean up <style/> rulesets without any css selectors left
      if (node.type === 'Ruleset' &&
        node.selector.selectors.isEmpty()) {
        list.remove(item);
      }
    });

    if (styleItem.cssAst.rules.isEmpty()) {
      // clean up now emtpy <style/>s
      var styleParentEl = styleItem.styleEl.parentNode;
      styleParentEl.spliceContent(styleParentEl.content.indexOf(styleItem.styleEl), 1);

      if (styleParentEl.elem === 'defs' &&
        styleParentEl.content.length === 0) {
        // also clean up now empty <def/>s
        var defsParentEl = styleParentEl.parentNode;
        defsParentEl.spliceContent(defsParentEl.content.indexOf(styleParentEl), 1);
      }

      continue;
    }

    // update existing, left over <style>s
    styleItem.styleEl.content[0].text = csso.translate(styleItem.cssAst);
  }

  return document;
};

var stylingProps = [
  'alignment-baseline',
  'baseline-shift',
  'buffered-rendering',
  'clip',
  'clip-path',
  'clip-rule',
  'color',
  'color-interpolation',
  'color-interpolation-filters',
  'color-profile',
  'color-rendering',
  'cursor',
  'direction',
  'display',
  'dominant-baseline',
  'enable-background',
  'fill',
  'fill-opacity',
  'fill-rule',
  'filter',
  'flood-color',
  'flood-opacity',
  'font-family',
  'font-size',
  'font-size-adjust',
  'font-stretch',
  'font-style',
  'font-variant',
  'font-weight',
  'glyph-orientation-horizontal',
  'glyph-orientation-vertical',
  'image-rendering',
  'kerning',
  'letter-spacing',
  'lighting-color',
  'marker-end',
  'marker-mid',
  'marker-start',
  'mask',
  'opacity',
  'overflow',
  'pointer-events',
  'shape-rendering',
  'solid-color',
  'solid-opacity',
  'stop-color',
  'stop-opacity',
  'stroke',
  'stroke-dasharray',
  'stroke-dashoffset',
  'stroke-linecap',
  'stroke-linejoin',
  'stroke-miterlimit',
  'stroke-opacity',
  'stroke-width',
  'paint-order',
  'text-anchor',
  'text-decoration',
  'text-overflow',
  'white-space',
  'text-rendering',
  'unicode-bidi',
  'vector-effect',
  'viewport-fill',
  'viewport-fill-opacity',
  'visibility',
  'white-space',
  'word-spacing',
  'writing-mode'
],
  rEscape = '\\\\(?:[0-9a-f]{1,6}\\s?|\\r\\n|.)',                 // Like \" or \2051. Code points consume one space.
  rAttr = '\\s*(' + g('[^:;\\\\]', rEscape) + '*?)\\s*',          // attribute name like ‘fill’
  rSingleQuotes = "'(?:[^'\\n\\r\\\\]|" + rEscape + ")*?(?:'|$)", // string in single quotes: 'smth'
  rQuotes = '"(?:[^"\\n\\r\\\\]|' + rEscape + ')*?(?:"|$)',       // string in double quotes: "smth"
  rQuotedString = new RegExp('^' + g(rSingleQuotes, rQuotes) + '$'),

  // Parentheses, E.g.: url(data:image/png;base64,iVBO...).
  // ':' and ';' inside of it should be threated as is. (Just like in strings.)
  rParenthesis = '\\(' + g('[^\'"()\\\\]+', rEscape, rSingleQuotes, rQuotes) + '*?' + '\\)',

  // The value. It can have strings and parentheses (see above). Fallbacks to anything in case of unexpected input.
  rValue = '\\s*(' + g('[^\'"();\\\\]+?', rEscape, rSingleQuotes, rQuotes, rParenthesis, '[^;]*?') + '*?' + ')',

  // End of declaration. Spaces outside of capturing groups help to do natural trimming.
  rDeclEnd = '\\s*(?:;\\s*|$)',

  // Final RegExp to parse CSS declarations.
  regDeclarationBlock = new RegExp(rAttr + ':' + rValue + rDeclEnd, 'ig'),

  // Comments expression. Honors escape sequences and strings.
  regStripComments = new RegExp(g(rEscape, rSingleQuotes, rQuotes, '/\\*[^]*?\\*/'), 'ig');

/**
 * Convert style in attributes. Cleanups comments and illegal declarations (without colon) as a side effect.
 *
 * @example
 * <g style="fill:#000; color: #fff;">
 *             ⬇
 * <g fill="#000" color="#fff">
 *
 * @example
 * <g style="fill:#000; color: #fff; -webkit-blah: blah">
 *             ⬇
 * <g fill="#000" color="#fff" style="-webkit-blah: blah">
 *
 * @param {Object} item current iteration item
 * @return {Boolean} if false, item will be filtered out
 *
 * @author Kir Belevich
 */
export function convertStyleToAttrs(item) {
  /* jshint boss: true */

  if (item.elem && item.hasAttr('style')) {
    // ['opacity: 1', 'color: #000']
    var styleValue = item.attr('style').value,
      styles = [],
      attrs = {};

    // Strip CSS comments preserving escape sequences and strings.
    styleValue = styleValue.replace(regStripComments, function (match) {
      return match[0] == '/' ? '' :
        match[0] == '\\' && /[-g-z]/i.test(match[1]) ? match[1] : match;
    });

    regDeclarationBlock.lastIndex = 0;
    for (var rule; rule = regDeclarationBlock.exec(styleValue);) {
      styles.push([rule[1], rule[2]]);
    }

    if (styles.length) {

      styles = styles.filter(function (style) {
        if (style[0]) {
          var prop = style[0].toLowerCase(),
            val = style[1];

          if (rQuotedString.test(val)) {
            val = val.slice(1, -1);
          }

          if (stylingProps.indexOf(prop) > -1) {

            attrs[prop] = {
              name: prop,
              value: val,
              local: prop,
              prefix: ''
            };

            return false;
          }
        }

        return true;
      });

      EXTEND(item.attrs, attrs);

      if (styles.length) {
        item.attr('style').value = styles
          .map(function (declaration) { return declaration.join(':') })
          .join(';');
      } else {
        item.removeAttr('style');
      }

    }

  }

};

function g(...args) {
  return '(?:' + Array.prototype.join.call(args, '|') + ')';
}
