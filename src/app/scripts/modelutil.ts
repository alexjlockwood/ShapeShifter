export function getOrderedAnimationBlocksByLayerIdAndProperty(animation) {
  let animationBlocksByLayerId = {};

  animation.blocks.forEach(block => {
    let blocksByProperty = animationBlocksByLayerId[block.layerId];
    if (!blocksByProperty) {
      blocksByProperty = {};
      animationBlocksByLayerId[block.layerId] = blocksByProperty;
    }

    blocksByProperty[block.propertyName] = blocksByProperty[block.propertyName] || [];
    blocksByProperty[block.propertyName].push(block);
  });

  for (let layerId in animationBlocksByLayerId) {
    let blocksByProperty = animationBlocksByLayerId[layerId];
    for (let propertyName in blocksByProperty) {
      blocksByProperty[propertyName].sort((a, b) => a.startTime - b.startTime);
    }
  }

  return animationBlocksByLayerId;
}

export function getUniqueId(opts) {
  opts = opts || {};
  opts.prefix = opts.prefix || '';
  opts.objectById = opts.objectById || (() => null);
  opts.targetObject = opts.targetObject || null;

  let n = 0;
  let id_ = () => opts.prefix + (n ? `_${n}` : '');
  while (true) {
    let o = opts.objectById(id_());
    if (!o || o === opts.targetObject) {
      break;
    }

    ++n;
  }

  return id_();
}
