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
export class Walker {

  // The traversal strategy defaults to the identity function.
  constructor(private _traversalFunc = obj => obj) { }

  // Performs a preorder traversal of `obj` and returns the first value
  // which passes a truth test.
  find(obj, visitor: VisitorFunc, ctx?) {
    let result;
    this.preorder(obj, function(v, k?, p?) {
      if (visitor.call(ctx, v, k, p)) {
        result = v;
        return stopWalk;
      }
    }, ctx);
    return result;
  }

  // Recursively traverses `obj` and returns all the elements that pass a
  // truth test. `strategy` is the traversal function to use, e.g. `preorder`
  // or `postorder`.
  filter(obj, strategy: StrategyFunc, visitor: VisitorFunc, ctx?) {
    const results = [];
    if (obj == null) {
      return results;
    }
    strategy(obj, function(v, k?, p?) {
      if (visitor.call(ctx, v, k, p)) {
        results.push(v);
      }
    }, null, this._traversalFunc);
    return results;
  }

  // Recursively traverses `obj` and returns all the elements for which a
  // truth test fails.
  reject(obj, strategy: StrategyFunc, visitor: VisitorFunc, ctx?) {
    return this.filter(obj, strategy, function(v, k?, p?) {
      return !visitor.call(ctx, v, k, p);
    });
  }

  // Produces a new array of values by recursively traversing `obj` and
  // mapping each value through the transformation function `visitor`.
  // `strategy` is the traversal function to use, e.g. `preorder` or
  // `postorder`.
  map(obj, strategy: StrategyFunc, visitor: VisitorFunc, ctx?) {
    const results = [];
    strategy(obj, function(v, k?, p?) {
      results[results.length] = visitor.call(ctx, v, k, p);
    }, null, this._traversalFunc);
    return results;
  }

  // Return the value of properties named `propertyName` reachable from the
  // tree rooted at `obj`. Results are not recursively searched; use
  // `pluckDeep` for that.
  pluck(obj, propertyName) {
    return this.pluckInternal(obj, propertyName, false);
  }

  // Version of `pluck` which recursively searches results for nested objects
  // with a property named `propertyName`.
  pluckDeep(obj, propertyName) {
    return this.pluckInternal(obj, propertyName, true);
  }

  // Internal helper providing the implementation for `pluck` and `pluckDeep`.
  private pluckInternal(obj, propertyName, isRecursive: boolean) {
    const results = [];
    this.preorder(obj, function(value, key?) {
      if (!isRecursive && key == propertyName) {
        return stopRecursion;
      }
      if (_.has(value, propertyName)) {
        results[results.length] = value[propertyName];
      }
    });
    return results;
  }

  // Recursively traverses `obj` in a depth-first fashion, invoking the
  // `visitor` function for each object only after traversing its children.
  // `traversalFunc` is intended for internal callers, and is not part
  // of the public API.
  postorder(obj, visitor: VisitorFunc, ctx?, traversalFunc?: TraversalFunc) {
    traversalFunc = traversalFunc || this._traversalFunc;
    walkInternal(obj, traversalFunc, null, visitor, ctx);
  }

  // Recursively traverses `obj` in a depth-first fashion, invoking the
  // `visitor` function for each object before traversing its children.
  // `traversalFunc` is intended for internal callers, and is not part
  // of the public API.
  preorder(obj, visitor: VisitorFunc, ctx?, traversalFunc?: TraversalFunc) {
    traversalFunc = traversalFunc || this._traversalFunc;
    walkInternal(obj, traversalFunc, visitor, null, ctx);
  }

  // Builds up a single value by doing a post-order traversal of `obj` and
  // calling the `visitor` function on each object in the tree. For leaf
  // objects, the `memo` argument to `visitor` is the value of the `leafMemo`
  // argument to `reduce`. For non-leaf objects, `memo` is a collection of
  // the results of calling `reduce` on the object's children.
  reduce(obj, visitor: (memo, value, key?, parent?) => any, leafMemo?, ctx?) {
    const reducer = function(value, key?, parent?, subResults?) {
      return visitor(subResults || leafMemo, value, key, parent);
    };
    return walkInternal(obj, this._traversalFunc, null, reducer, ctx, true);
  }

  collect(obj, strategy: StrategyFunc, visitor: VisitorFunc, ctx?) {
    return this.map(obj, strategy, visitor, ctx);
  }

  detect(obj, visitor: VisitorFunc, ctx?) {
    return this.find(obj, visitor, ctx);
  }

  select(obj, strategy: StrategyFunc, visitor: VisitorFunc, ctx?) {
    return this.filter(obj, strategy, visitor, ctx);
  }
}

// Walk the tree recursively beginning with `root`, calling `beforeFunc`
// before visiting an objects descendents, and `afterFunc` afterwards.
// If `collectResults` is true, the last argument to `afterFunc` will be a
// collection of the results of walking the node's subtrees.
function walkInternal(
  root,
  traversalFunc: TraversalFunc,
  beforeFunc: (value, key?, parent?) => any,
  afterFunc: (value, key?, parent?, subResults?) => any,
  context,
  collectResults?: boolean) {

  const visited = [];
  return (function _walk(value, key?, parent?) {
    // Keep track of objects that have been visited, and throw an exception
    // when trying to visit the same object twice.
    if (_.isObject(value)) {
      if (visited.indexOf(value) >= 0) {
        throw new TypeError('Not a tree: same object found in two different branches');
      }
      visited.push(value);
    }

    if (beforeFunc) {
      const result = beforeFunc.call(context, value, key, parent);
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
      const stop = _.some(target, (obj, key?) => {
        const result = _walk(obj, key, value);
        if (result === stopWalk) {
          return true;
        }
        if (subResults) {
          subResults[key] = result;
        }
      });
      if (stop) {
        return stopWalk;
      }
    }
    if (afterFunc) {
      return afterFunc.call(context, value, key, parent, subResults);
    }
  })(root);
}

type VisitorFunc = (value, key, parent) => any;
type StrategyFunc = (obj, visitor: VisitorFunc, ctx, traversalFunc: TraversalFunc) => void;
type TraversalFunc = (obj) => any;
