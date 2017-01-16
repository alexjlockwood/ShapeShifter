import * as _ from 'lodash';
import { } from 'jasmine';
import { Walker } from './walker';

describe('Walk', () => {

  const getSimpleTestTree = () => {
    return {
      val: 0,
      l: { val: 1, l: { val: 2 }, r: { val: 3 } },
      r: { val: 4, l: { val: 5 }, r: { val: 6 } }
    };
  };

  const getMixedTestTree = () => {
    return {
      current:
      { city: 'Munich', aliases: ['Muenchen'], population: 1378000 },
      previous: [
        { city: 'San Francisco', aliases: ['SF', 'San Fran'], population: 812826 },
        { city: 'Toronto', aliases: ['TO', 'T-dot'], population: 2615000 }
      ]
    };
  };

  const walker = new Walker();

  it('basic', () => {
    // Updates the value of `node` to be the sum of the values of its subtrees.
    // Ignores leaf nodes.
    const visitor = node => {
      if (node.l && node.r) {
        node.val = node.l.val + node.r.val;
      }
    };
    let tree = getSimpleTestTree();
    walker.postorder(tree, visitor);
    expect(tree.val).toBe(16, 'should visit subtrees first');

    tree = getSimpleTestTree();
    walker.preorder(tree, visitor);
    expect(tree.val).toBe(5, 'should visit subtrees after the node itself');
  });

  it('circularRefs', () => {
    let tree = getSimpleTestTree();
    (tree.l.l as any).r = tree;
    expect(() => { walker.preorder(tree, _.identity); })
      .toThrow(new TypeError('Not a tree: same object found in two different branches'));
    expect(() => { walker.postorder(tree, _.identity); })
      .toThrow(new TypeError('Not a tree: same object found in two different branches'));

    tree = getSimpleTestTree();
    tree.r.l = tree.r;
    expect(() => { walker.preorder(tree, _.identity); })
      .toThrow(new TypeError('Not a tree: same object found in two different branches'));
  });

  it('simpleMap', () => {
    const visitor = function(this: any, node, key, parent) {
      if (_.has(node, 'val')) {
        return node.val;
      }
      if (key !== 'val') {
        throw new Error('Leaf node with incorrect key');
      }
      return (this && this.leafChar) || '-';
    };

    let visited = walker.map(getSimpleTestTree(), walker.preorder, visitor).join('');
    expect(visited).toBe('0-1-2-3-4-5-6-', 'pre-order map');

    visited = walker.map(getSimpleTestTree(), walker.postorder, visitor).join('');
    expect(visited).toBe('---2-31--5-640', 'post-order map');

    const context = { leafChar: '*' };
    visited = walker.map(getSimpleTestTree(), walker.preorder, visitor, context).join('');
    expect(visited).toBe('0*1*2*3*4*5*6*', 'pre-order with context');

    visited = walker.map(getSimpleTestTree(), walker.postorder, visitor, context).join('');
    expect(visited).toBe('***2*31**5*640', 'post-order with context');

    if (document.querySelector && document.querySelector('#map-test')) {
      const domWalker = new Walker<Element>(obj => obj.children ? obj.children : obj);
      const root = document.querySelector('#map-test');
      let ids = domWalker.map(root, domWalker.preorder, el => { return el.id; });
      expect(ids).toEqual(['map-test', 'id1', 'id2'], 'preorder map with DOM elements');

      ids = domWalker.map(root, domWalker.postorder, el => { return el.id; });
      expect(ids).toEqual(['id1', 'id2', 'map-test'], 'postorder map with DOM elements');
    }
  });

  it('mixedMap', () => {
    const visitor = (node, key, parent) => {
      return _.isString(node) ? node.toLowerCase() : undefined;
    };

    const tree = getMixedTestTree();
    const preorderResult = walker.map(tree, walker.preorder, visitor);
    expect(preorderResult.length).toBe(19, 'all nodes are visited');
    expect(_.reject(preorderResult, _.isUndefined)).toEqual(
      ['munich', 'muenchen', 'san francisco', 'sf', 'san fran', 'toronto', 'to', 't-dot'], 'pre-order map on a mixed tree');

    const postorderResult = walker.map(tree, walker.postorder, visitor);
    expect(preorderResult.sort()).toEqual(postorderResult.sort(), 'post-order map on a mixed tree');

    const newTree = [['foo'], tree];
    const result = walker.map(newTree, walker.postorder, visitor);
    expect(_.difference(result, postorderResult)).toEqual(['foo'], 'map on list of trees');
  });

  it('reduce', () => {
    const add = (a, b) => a + b;
    const leafMemo = [];
    const sum = (memo, node) => {
      if (_.isObject(node)) {
        return _.reduce(memo, add, 0);
      }
      expect(memo).toEqual(leafMemo);
      return node;
    };
    let tree = getSimpleTestTree();
    expect(walker.reduce(tree, sum, leafMemo)).toBe(21);

    // A more useful example: transforming a tree.

    // Returns a new node where the left and right subtrees are swapped.
    const mirror = (memo, node) => {
      if (!_.has(node, 'r')) {
        return node;
      }
      return _.extend(_.clone(node), { l: memo.r, r: memo.l });
    };
    // Returns the '-' for internal nodes, and the value itself for leaves.
    const toString = node => {
      return _.has(node, 'val') ? '-' : node;
    };

    tree = walker.reduce(getSimpleTestTree(), mirror);
    expect(walker.reduce(tree, sum, leafMemo)).toBe(21);
    expect(walker.map(tree, walker.preorder, toString).join('')).toBe('-0-4-6-5-1-3-2', 'pre-order map');
  });

  it('find', () => {
    const tree = getSimpleTestTree();

    // Returns a visitor function that will succeed when a node with the given
    // value is found, and then raise an exception the next time it's called.
    const findValue = value => {
      let found = false;
      return node => {
        if (found) {
          throw new Error('already found!');
        }
        found = (node.val === value);
        return found;
      };
    };

    expect(walker.find(tree, findValue(0)).val).toBe(0);
    expect(walker.find(tree, findValue(6)).val).toBe(6);
    expect(walker.find(tree, findValue(99))).toEqual(undefined);
  });

  it('filter', () => {
    const tree = getSimpleTestTree();
    (tree.r as any).val = '.oOo.';  // Remove one of the numbers.
    const isEvenNumber = x => {
      return _.isNumber(x) && x % 2 === 0;
    };

    expect(walker.filter(tree, walker.preorder, _.isObject).length).toBe(7, 'filter objects');
    expect(walker.filter(tree, walker.preorder, _.isNumber).length).toBe(6, 'filter numbers');
    expect(walker.filter(tree, walker.postorder, _.isNumber).length).toBe(6, 'postorder filter numbers');
    expect(walker.filter(tree, walker.preorder, isEvenNumber).length).toBe(3, 'filter even numbers');

    // With the identity function, only the value '0' should be omitted.
    expect(walker.filter(tree, walker.preorder, _.identity).length).toBe(13, 'filter on identity function');
  });

  it('reject', () => {
    const tree = getSimpleTestTree();
    (tree.r as any).val = '.oOo.';  // Remove one of the numbers.

    expect(walker.reject(tree, walker.preorder, _.isObject).length).toBe(7, 'reject objects');
    expect(walker.reject(tree, walker.preorder, _.isNumber).length).toBe(8, 'reject numbers');
    expect(walker.reject(tree, walker.postorder, _.isNumber).length).toBe(8, 'postorder reject numbers');

    // With the identity function, only the value '0' should be kept.
    expect(walker.reject(tree, walker.preorder, _.identity).length).toBe(1, 'reject with identity function');
  });

  it('customTraversal', () => {
    const tree = getSimpleTestTree();

    // Set up a walker that will not traverse the 'val' properties.
    const customWalker = new Walker(node => {
      return _.omit(node, 'val');
    });
    const visitor = node => {
      if (!_.isObject(node)) {
        throw new Error('Leaf value visited when it shouldn\'t be');
      }
    };
    expect(customWalker.map(tree, walker.postorder, _.identity).length).toBe(7, 'traversal strategy is dynamically scoped');
    expect(walker.map(tree, walker.postorder, _.identity).length).toBe(14, 'default map still works');
  });
});
