import * as specificity from 'specificity';
import * as stable from 'stable';
import * as csso from 'csso';
import { Plugin } from './Plugin';

export const inlineStyles: Plugin = {
  type: 'full',
  fn: inlineStylesFn,
};

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
 */
function inlineStylesFn(
  document,
  onlyMatchedOnce = false,
  removeMatchedSelectors = true,
  useMqs = ['screen'],
  usePseudoClasses = []) {
  console.log(document);

  // collect <style/>s
  const styleEls = document.querySelectorAll('style');

  const styleItems = [];
  const selectorItems = [];
  for (const styleElIndex in styleEls) {
    if (!styleEls.hasOwnProperty(styleElIndex)) {
      continue;
    }

    const styleEl = styleEls[styleElIndex];
    if (styleEl.isEmpty()) {
      // skip empty <style/>s
      continue;
    }
    const cssStr = styleEl.content[0].text || styleEl.content[0].cdata || [];

    // collect <style/>s and their css ast
    const cssAst = csso.parse(cssStr, { context: 'stylesheet' });
    styleItems.push({ styleEl, cssAst });

    // collect css selectors and their containing ruleset
    let curAtruleExpNode = null;
    let curPseudoClassItem = null;
    let curPseudoClassList = null;

    interface Context { ruleset: any; }
    csso.walk(cssAst, function (this: Context, node, item, list) {
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

        const curSelectorItem = {
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
  const selectorItemsMqs = selectorItems.filter(function (selectorItem) {
    if (selectorItem.atRuleExpNode === null) {
      return true;
    }
    const mqStr = csso.translate(selectorItem.atRuleExpNode);
    return useMqs.indexOf(mqStr) > -1;
  });

  // filter for pseudo classes to be used or not using a pseudo class
  const selectorItemsPseudoClasses = selectorItemsMqs.filter(function (selectorItem) {
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
  const selectorItemsSorted = stable(selectorItemsPseudoClasses, function (itemA, itemB) {
    return specificity.compare(itemA.selectorStr, itemB.selectorStr);
  }).reverse(); // last declaration applies last (final)

  // apply <style/> styles to matched elements
  for (const selectorItemIndex in selectorItemsSorted) {
    if (!selectorItemsSorted.hasOwnProperty(selectorItemIndex)) {
      continue;
    }

    const selectorItem = selectorItemsSorted[selectorItemIndex];
    let selectedEls = undefined;
    try {
      selectedEls = document.querySelectorAll(selectorItem.selectorStr);
    } catch (e) {
      if (e.constructor === SyntaxError) {
        console.warn('Syntax error when trying to select \n\n' + selectorItem.selectorStr + '\n\n, skipped.');
        continue;
      }
      throw e;
    }

    if (onlyMatchedOnce && selectedEls !== null && selectedEls.length > 1) {
      // skip selectors that match more than once if option onlyMatchedOnce is enabled
      continue;
    }

    for (const selectedElIndex in selectedEls) {
      if (!selectedEls.hasOwnProperty(selectedElIndex)) {
        continue;
      }
      const selectedEl = selectedEls[selectedElIndex];

      // empty defaults in case there is no style attribute
      let elInlineStyleAttr = { name: 'style', value: '', prefix: '', local: 'style' };
      let elInlineStyles = '';

      if (selectedEl.hasAttr('style')) {
        elInlineStyleAttr = selectedEl.attr('style');
        elInlineStyles = elInlineStyleAttr.value;
      }
      const inlineCssAst = csso.parse(elInlineStyles, { context: 'block' });

      // merge element(inline) styles + matching <style/> styles
      const newInlineCssAst = csso.parse('', { context: 'block' }); // for an empty css ast (in block context)

      const mergedDeclarations = [];
      const _fetchDeclarations = function (node, item) {
        if (node.type === 'Declaration') {
          mergedDeclarations.push(item);
        }
      };
      const itemRulesetNodeCloned = csso.clone(selectorItem.rulesetNode);
      // clone to prevent leaking declaration references (csso.translate(...))
      csso.walk(itemRulesetNodeCloned, _fetchDeclarations);
      csso.walk(inlineCssAst, _fetchDeclarations);

      // sort by !important(ce)
      const mergedDeclarationsSorted = stable(mergedDeclarations, function (declarationA, declarationB) {
        const declarationAScore = ~~declarationA.data.value.important;
        const declarationBScore = ~~declarationB.data.value.important;
        return (declarationAScore - declarationBScore);
      });

      // to css
      for (const mergedDeclarationsSortedIndex in mergedDeclarationsSorted) {
        if (!mergedDeclarationsSorted.hasOwnProperty(mergedDeclarationsSortedIndex)) {
          continue;
        }
        const declaration = mergedDeclarationsSorted[mergedDeclarationsSortedIndex];
        newInlineCssAst.declarations.insert(declaration);
      }
      const newCss = csso.translate(newInlineCssAst);

      elInlineStyleAttr.value = newCss;
      selectedEl.addAttr(elInlineStyleAttr);
    }

    if (removeMatchedSelectors && selectedEls !== null && selectedEls.length > 0) {
      // clean up matching simple selectors if option removeMatchedSelectors is enabled
      selectorItem.rulesetNode.selector.selectors.remove(selectorItem.simpleSelectorItem);
    }
  }

  let styleItem: any = {};
  for (const styleItemIndex in styleItems) {
    if (!styleItems.hasOwnProperty(styleItemIndex)) {
      continue;
    }
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
      const styleParentEl = styleItem.styleEl.parentNode;
      styleParentEl.spliceContent(styleParentEl.content.indexOf(styleItem.styleEl), 1);

      if (styleParentEl.elem === 'defs' &&
        styleParentEl.content.length === 0) {
        // also clean up now empty <def/>s
        const defsParentEl = styleParentEl.parentNode;
        defsParentEl.spliceContent(defsParentEl.content.indexOf(styleParentEl), 1);
      }
      continue;
    }

    // update existing, left over <style>s
    styleItem.styleEl.content[0].text = csso.translate(styleItem.cssAst);
  }

  return document;
};
