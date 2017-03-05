/* tslint:disable */

import * as collections from './_collections';

export const removeUnknownsAndDefaults = {
  active: true,
  type: 'perItem',
  fn: removeUnknownsAndDefaultsFn,
  params: {
    unknownContent: true,
    unknownAttrs: true,
    defaultAttrs: true,
    uselessOverrides: true,
    keepDataAttrs: true
  },
};

var elems = collections.elems,
  attrsGroups = collections.attrsGroups,
  elemsGroups = collections.elemsGroups,
  attrsGroupsDefaults = collections.attrsGroupsDefaults,
  attrsInheritable = collections.inheritableAttrs;

// collect and extend all references
for (var elem in elems) {
  const myElem: any = elems[elem];

  if (myElem.attrsGroups) {
    myElem.attrs = myElem.attrs || [];

    myElem.attrsGroups.forEach(function (attrsGroupName) {
      myElem.attrs = myElem.attrs.concat(attrsGroups[attrsGroupName]);

      var groupDefaults = attrsGroupsDefaults[attrsGroupName];

      if (groupDefaults) {
        myElem.defaults = myElem.defaults || {};

        for (var attrName in groupDefaults) {
          myElem.defaults[attrName] = groupDefaults[attrName];
        }
      }
    });

  }

  if (myElem.contentGroups) {
    myElem.content = myElem.content || [];

    myElem.contentGroups.forEach(function (contentGroupName) {
      myElem.content = myElem.content.concat(elemsGroups[contentGroupName]);
    });
  }
}

/**
 * Remove unknown elements content and attributes,
 * remove attributes with default values.
 *
 * @param {Object} item current iteration item
 * @param {Object} params plugin params
 * @return {Boolean} if false, item will be filtered out
 */
function removeUnknownsAndDefaultsFn(item, params) {

  // elems w/o namespace prefix
  if (item.isElem() && !item.prefix) {

    var elem = item.elem;

    // remove unknown element's content
    if (
      params.unknownContent &&
      !item.isEmpty() &&
      elems[elem] && // make sure we know of this element before checking its children
      elem !== 'foreignObject' // Don't check foreignObject
    ) {
      item.content.forEach(function (content, i) {
        if (
          content.isElem() &&
          !content.prefix &&
          (
            (
              elems[elem].content && // Do we have a record of its permitted content?
              elems[elem].content.indexOf(content.elem) === -1
            ) ||
            (
              !elems[elem].content && // we dont know about its permitted content
              !elems[content.elem] // check that we know about the element at all
            )
          )
        ) {
          item.content.splice(i, 1);
        }
      });
    }

    // remove element's unknown attrs and attrs with default values
    if (elems[elem] && elems[elem].attrs) {

      item.eachAttr(function (attr) {

        if (
          attr.name !== 'xmlns' &&
          (attr.prefix === 'xml' || !attr.prefix) &&
          (!params.keepDataAttrs || attr.name.indexOf('data-') != 0)
        ) {
          if (
            // unknown attrs
            (
              params.unknownAttrs &&
              elems[elem].attrs.indexOf(attr.name) === -1
            ) ||
            // attrs with default values
            (
              params.defaultAttrs &&
              elems[elem].defaults &&
              elems[elem].defaults[attr.name] === attr.value && (
                attrsInheritable.indexOf(attr.name) < 0 ||
                !item.parentNode.computedAttr(attr.name)
              )
            ) ||
            // useless overrides
            (
              params.uselessOverrides &&
              attr.name !== 'transform' &&
              attrsInheritable.indexOf(attr.name) > -1 &&
              item.parentNode.computedAttr(attr.name, attr.value)
            )
          ) {
            item.removeAttr(attr.name);
          }
        }

      });

    }

  }

};
