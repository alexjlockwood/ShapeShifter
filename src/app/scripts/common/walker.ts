import * as _ from 'lodash';

// An internal object that can be returned from a visitor function to
// prevent a top-down walk from walking subtrees of a node.
const stopRecursion = {};

// An internal object that can be returned from a visitor function to
// cause the walk to immediately stop.
const stopWalk = {};

// A Walker is a functional utility class that can traverse and manipulate
// tree like structures. This can be extremely useful when parsing SVG
// DOM trees, finding vector drawable layers by their IDs, interpolating
// properties on a layer's descendants on each animation frame, etc.
export class Walker<T> {

  // The traversal strategy defaults to the identity function.
  constructor(private _traversalFunc: TraversalFunc<T> = obj => obj) { }

  // Performs a preorder traversal of `obj` and returns the first value
  // which passes a truth test.
  find(obj: T, visitor: (v: T, k, p) => boolean, ctx?) {
    let result;
    this.preorder(obj, function(v, k?, p?) {
      if (visitor.call(ctx, v, k, p)) {
        result = v;
        return stopWalk;
      }
      return undefined;
    }, ctx);
    return result;
  }

  // Recursively traverses `obj` and returns all the elements that pass a
  // truth test. `strategy` is the traversal function to use, e.g. `preorder`
  // or `postorder`.
  filter(obj: T, strategy: StrategyFunc<T>, visitor: (v: T, k?, p?) => boolean, ctx?) {
    const results = [];
    if (!obj) {
      return results;
    }
    strategy(obj, function(v, k?, p?) {
      if (visitor.call(ctx, v, k, p)) {
        results.push(v);
      }
    }, undefined, this._traversalFunc);
    return results;
  }

  // Recursively traverses `obj` and returns all the elements for which a
  // truth test fails.
  reject(obj: T, strategy: StrategyFunc<T>, visitor: (v: T, k?, p?) => boolean, ctx?) {
    return this.filter(obj, strategy, function(v, k?, p?) {
      return !visitor.call(ctx, v, k, p);
    });
  }

  // Produces a new array of values by recursively traversing `obj` and
  // mapping each value through the transformation function `visitor`.
  // `strategy` is the traversal function to use, e.g. `preorder` or
  // `postorder`.
  map<U>(obj: T, strategy: StrategyFunc<T>, visitor: (v: T, k?, p?) => U, ctx?) {
    const results: U[] = [];
    strategy(obj, function(v, k?, p?) {
      results[results.length] = visitor.call(ctx, v, k, p);
    }, undefined, this._traversalFunc);
    return results;
  }

  // Recursively traverses `obj` in a depth-first fashion, invoking the
  // `visitor` function for each object only after traversing its children.
  // `traversalFunc` is intended for internal callers, and is not part
  // of the public API.
  postorder(obj: T, visitor: (v: T, k?, p?) => void, ctx?, traversalFunc = this._traversalFunc) {
    walkInternal(obj, traversalFunc, undefined, visitor, ctx);
  }

  // Recursively traverses `obj` in a depth-first fashion, invoking the
  // `visitor` function for each object before traversing its children.
  // `traversalFunc` is intended for internal callers, and is not part
  // of the public API.
  preorder(obj: T, visitor: (v: T, k?, p?) => void, ctx?, traversalFunc = this._traversalFunc) {
    walkInternal(obj, traversalFunc, visitor, undefined, ctx);
  }

  // Builds up a single value by doing a post-order traversal of `obj` and
  // calling the `visitor` function on each object in the tree. For leaf
  // objects, the `memo` argument to `visitor` is the value of the `leafMemo`
  // argument to `reduce`. For non-leaf objects, `memo` is a collection of
  // the results of calling `reduce` on the object's children.
  reduce(obj: T, visitor: (memo, v, k?, p?) => any, leafMemo?, ctx?) {
    const reducer = function(v, k?, p?, subResults?) {
      return visitor(subResults || leafMemo, v, k, p);
    };
    return walkInternal(obj, this._traversalFunc, undefined, reducer, ctx, true);
  }

  collect<U>(obj: T, strategy: StrategyFunc<T>, visitor: (v: T, k?, p?) => U, ctx?) {
    return this.map<U>(obj, strategy, visitor, ctx);
  }

  detect(obj: T, visitor: (v: T, k, p) => boolean, ctx?) {
    return this.find(obj, visitor, ctx);
  }

  select(obj: T, strategy: StrategyFunc<T>, visitor: (v: T, k?, p?) => boolean, ctx?) {
    return this.filter(obj, strategy, visitor, ctx);
  }
}

// Walk the tree recursively beginning with `root`, calling `beforeFunc`
// before visiting an objects descendents, and `afterFunc` afterwards.
// If `collectResults` is true, the last argument to `afterFunc` will be a
// collection of the results of walking the node's subtrees.
function walkInternal<T>(
  root,
  traversalFunc: TraversalFunc<T>,
  beforeFunc: (value: T, key?, parent?) => any,
  afterFunc: (value: T, key?, parent?, subResults?) => any,
  ctx,
  collectResults?: boolean) {

  const visited = [];
  return (function _walk(value: T, key?, parent?) {
    // Keep track of objects that have been visited, and throw an exception
    // when trying to visit the same object twice.
    if (_.isObject(value)) {
      if (visited.indexOf(value) >= 0) {
        throw new TypeError(
          'Not a tree: same object found in two different branches');
      }
      visited.push(value);
    }

    if (beforeFunc) {
      const result = beforeFunc.call(ctx, value, key, parent);
      if (result === stopWalk) {
        return stopWalk;
      }
      if (result === stopRecursion) {
        return;
      }
    }

    let subResults;
    const target = traversalFunc(value);
    if (_.isObject(target) && !_.isEmpty(target)) {
      // If collecting results from subtrees, collect them in the same shape
      // as the parent node.
      if (collectResults) {
        subResults = Array.isArray(value) ? [] : {};
      }
      const stop = _.some(target, function(obj: T, k?){
        const result = _walk(obj, k, value);
        if (result === stopWalk) {
          return true;
        }
        if (subResults) {
          subResults[k] = result;
        }
        return undefined;
      });
      if (stop) {
        return stopWalk;
      }
    }
    if (afterFunc) {
      return afterFunc.call(ctx, value, key, parent, subResults);
    }
  })(root);
}

type VisitorFunc<T> = (value: T, key, parent) => any;
type StrategyFunc<T> = (obj: T, visitor: VisitorFunc<T>, ctx, traversalFunc: TraversalFunc<T>) => void;
type TraversalFunc<T> = (obj: T) => any;
