import * as _ from 'lodash';

type VisitorFunc = (value, key, parent) => any;
type StrategyFunc = (obj, visitor: VisitorFunc, context, traversalStrategy: TraversalFunc) => void;
type TraversalFunc = (obj) => any;

// An internal object that can be returned from a visitor function to
// prevent a top-down walk from walking subtrees of a node.
const stopRecursion = {};

// An internal object that can be returned from a visitor function to
// cause the walk to immediately stop.
const stopWalk = {};

const notTreeError = 'Not a tree: same object found in two different branches';

export class Walker {

  constructor(private _traversalStrategy = defaultTraversal) { }

  // Performs a preorder traversal of `obj` and returns the first value
  // which passes a truth test.
  find(obj, visitor: VisitorFunc, context?) {
    let result;
    this.preorder(obj, function(value, key, parent) {
      if (visitor.call(context, value, key, parent)) {
        result = value;
        return stopWalk;
      }
    }, context);
    return result;
  }

  // Recursively traverses `obj` and returns all the elements that pass a
  // truth test. `strategy` is the traversal function to use, e.g. `preorder`
  // or `postorder`.
  filter(obj, strategy: StrategyFunc, visitor: VisitorFunc, context?) {
    const results = [];
    if (obj == null) {
      return results;
    }
    strategy(obj, function(value, key, parent) {
      if (visitor.call(context, value, key, parent)) {
        results.push(value);
      }
    }, null, this._traversalStrategy);
    return results;
  }

  // Recursively traverses `obj` and returns all the elements for which a
  // truth test fails.
  reject(obj, strategy: StrategyFunc, visitor: VisitorFunc, context?) {
    return this.filter(obj, strategy, function(value, key, parent) {
      return !visitor.call(context, value, key, parent);
    });
  }

  // Produces a new array of values by recursively traversing `obj` and
  // mapping each value through the transformation function `visitor`.
  // `strategy` is the traversal function to use, e.g. `preorder` or
  // `postorder`.
  map(obj, strategy: StrategyFunc, visitor: VisitorFunc, context?) {
    const results = [];
    strategy(obj, function(value, key, parent) {
      results[results.length] = visitor.call(context, value, key, parent);
    }, null, this._traversalStrategy);
    return results;
  }

  // Return the value of properties named `propertyName` reachable from the
  // tree rooted at `obj`. Results are not recursively searched; use
  // `pluckRec` for that.
  pluck(obj, propertyName) {
    return this.pluckInternal(obj, propertyName, false);
  }

  // Version of `pluck` which recursively searches results for nested objects
  // with a property named `propertyName`.
  pluckRec(obj, propertyName) {
    return this.pluckInternal(obj, propertyName, true);
  }

  // Internal helper providing the implementation for `pluck` and `pluckRec`.
  private pluckInternal(obj, propertyName, recursive: boolean) {
    const results = [];
    this.preorder(obj, function(value, key) {
      if (!recursive && key == propertyName) {
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
  // `traversalStrategy` is intended for internal callers, and is not part
  // of the public API.
  postorder(obj, visitor: VisitorFunc, context?, traversalStrategy?: TraversalFunc) {
    traversalStrategy = traversalStrategy || this._traversalStrategy;
    walkInternal(obj, traversalStrategy, null, visitor, context);
  }

  // Recursively traverses `obj` in a depth-first fashion, invoking the
  // `visitor` function for each object before traversing its children.
  // `traversalStrategy` is intended for internal callers, and is not part
  // of the public API.
  preorder(obj, visitor: VisitorFunc, context?, traversalStrategy?: TraversalFunc) {
    traversalStrategy = traversalStrategy || this._traversalStrategy;
    walkInternal(obj, traversalStrategy, visitor, null, context);
  }

  // Builds up a single value by doing a post-order traversal of `obj` and
  // calling the `visitor` function on each object in the tree. For leaf
  // objects, the `memo` argument to `visitor` is the value of the `leafMemo`
  // argument to `reduce`. For non-leaf objects, `memo` is a collection of
  // the results of calling `reduce` on the object's children.
  reduce(obj, visitor: (memo, value, key, parent) => any, leafMemo, context?) {
    const reducer = function(value, key, parent, subResults) {
      return visitor(subResults || leafMemo, value, key, parent);
    };
    return walkInternal(obj, this._traversalStrategy, null, reducer, context, true);
  }

  collect(obj, strategy: StrategyFunc, visitor: VisitorFunc, context?) {
    return this.map(obj, strategy, visitor, context);
  }

  detect(obj, visitor: VisitorFunc, context?) {
    return this.find(obj, visitor, context);
  }

  select(obj, strategy: StrategyFunc, visitor: VisitorFunc, context?) {
    return this.filter(obj, strategy, visitor, context);
  }
}

// Walk the tree recursively beginning with `root`, calling `beforeFunc`
// before visiting an objects descendents, and `afterFunc` afterwards.
// If `collectResults` is true, the last argument to `afterFunc` will be a
// collection of the results of walking the node's subtrees.
function walkInternal(
  root,
  traversalStrategy: TraversalFunc,
  beforeFunc: (value, key, parent) => any,
  afterFunc: (value, key, parent, subresults?) => any,
  context,
  collectResults?: boolean) {

  const visited = [];
  return (function _walk(value, key?, parent?) {
    // Keep track of objects that have been visited, and throw an exception
    // when trying to visit the same object twice.
    if (_.isObject(value)) {
      if (visited.indexOf(value) >= 0) {
        throw new TypeError(notTreeError);
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
    const target = traversalStrategy(value);
    if (_.isObject(target) && !_.isEmpty(target)) {
      // If collecting results from subtrees, collect them in the same shape
      // as the parent node.
      if (collectResults) {
        subResults = Array.isArray(value) ? [] : {};
      }
      const stop = _.some(target, (obj, key) => {
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

// Implements the default traversal strategy: if `obj` is a DOM node, walk
// its DOM children; otherwise, walk all the objects it references.
function defaultTraversal(obj) {
  return _.isElement(obj) ? obj.children : obj;
}

// Returns an object containing the walk functions. If `traversalStrategy`
// is specified, it is a function determining how objects should be
// traversed. Given an object, it returns the object to be recursively
// walked. The default strategy is equivalent to `_.identity` for regular
// objects, and for DOM nodes it returns the node's DOM children.
// function walk(traversalStrategy?: TraversalFunc) {
//   return new Walker(traversalStrategy || defaultTraversal);
// Bind all of the public functions in the walker to itself. This allows
// the traversal strategy to be dynamically scoped.
// _.bindAll.apply(null, [walker].concat(_.keys(walker)));
// walker._traversalStrategy = traversalStrategy || defaultTraversal;
// return walker;
// }
// Use `_.walk` as a namespace to hold versions of the walk functions which
// use the default traversal strategy.
// _.extend(walk, walk());
// _.mixin({ walk: walk });
