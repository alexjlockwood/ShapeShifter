/* tslint:disable */

/**
 * Plugins engine.
 *
 * @module plugins
 *
 * @param {Object} data input data
 * @param {Object} plugins plugins object from config
 * @return {Object} output data
 */
export function executePlugins(data, plugins) {
  plugins.forEach(function(group) {
    switch (group[0].type) {
      case 'perItem':
        data = perItem(data, group);
        break;
      case 'perItemReverse':
        data = perItem(data, group, true);
        break;
      case 'full':
        data = full(data, group);
        break;
    }
  });
  return data;
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
    items.content = items.content.filter(function(item) {
      // Reverse pass.
      if (reverse && item.content) {
        monkeys(item);
      }
      // Main filter.
      var filter = true;
      for (var i = 0; filter && i < plugins.length; i++) {
        var plugin = plugins[i];
        if (plugin.active && plugin.fn(item, plugin.params) === false) {
          filter = false;
        }
      }
      // Direct pass.
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
 * "Full" plugins.
 *
 * @param {Object} data input data
 * @param {Array} plugins plugins list to process
 * @return {Object} output data
 */
function full(data, plugins) {
  plugins.forEach(function(plugin) {
    if (plugin.active) {
      data = plugin.fn(data, plugin.params);
    }
  });
  return data;
}
