// TODO(alockwood): convert to typescript

import {default as bezierEasing} from 'bezier-easing';
import { SvgPathData } from './svgpathdata';
import {
  Property,
  EnumProperty,
  ColorProperty,
  PathDataProperty,
  FractionProperty,
  IdProperty,
  NumberProperty
} from './modelproperties';

/**
 * Base class for any node in the tree, including path layers, layer groups, and artworks.
 */
export class BaseLayer {
  constructor(obj = {}, opts = {}) {
    this.parent = null;
    this.id = obj.id || null;
    if (opts && opts.linkSelectedState) {
      this.selectedStateLinkedObj_ = obj;
    }
  }

  get selected() {
    return this.selectedStateLinkedObj_
        ? this.selectedStateLinkedObj_.selected_
        : this.selected_;
  }

  computeBounds() {
    return null;
  }

  getSibling_(offs) {
    if (!this.parent || !this.parent.layers) {
      return null;
    }

    let index = this.parent.layers.indexOf(this);
    if (index < 0) {
      return null;
    }

    index += offs;
    if (index < 0 || index >= this.parent.layers.length) {
      return null;
    }

    return this.parent.layers[index];
  }

  get previousSibling() {
    return this.getSibling_(-1);
  }

  get nextSibling() {
    return this.getSibling_(1);
  }

  remove() {
    if (!this.parent || !this.parent.layers) {
      return;
    }

    let index = this.parent.layers.indexOf(this);
    if (index >= 0) {
      this.parent.layers.splice(index, 1);
    }

    this.parent = null;
  }

  walk(fn, context) {
    let visit_ = (layer, context) => {
      let childContext = fn(layer, context);
      if (layer.layers) {
        walkLayerGroup_(layer, childContext);
      }
    };

    let walkLayerGroup_ = (layerGroup, context) => {
      layerGroup.layers.forEach(layer => visit_(layer, context));
    };

    visit_(this, context);
  }

  toJSON() {
    return {
      id: this.id,
      type: this.typeString,
    };
  }

  static load(obj = {}, opts) {
    if (obj instanceof BaseLayer) {
      return new obj.constructor(obj, opts);
    }

    return new LAYER_CLASSES_BY_TYPE[obj.type || 'path'](obj, opts);
  }
}


Property.registerProperties(BaseLayer, [
  {name: 'id', property: new IdProperty()}
]);


/**
 * A path layer, which is the main building block for visible content in a vector
 * artwork.
 */
export class PathLayer extends BaseLayer {
  constructor(obj = {}, opts = {}) {
    super(obj, opts);
    this.pathData = obj.pathData || '';
    this.fillColor = obj.fillColor || null;
    this.fillAlpha = ('fillAlpha' in obj) ? obj.fillAlpha : 1;
    this.strokeColor = obj.strokeColor || '';
    this.strokeAlpha = ('strokeAlpha' in obj) ? obj.strokeAlpha : 1;
    this.strokeWidth = obj.strokeWidth || 0;
    this.strokeLinecap = obj.strokeLinecap || 'butt';
    this.strokeLinejoin = obj.strokeLinejoin || 'miter';
    this.strokeMiterLimit = obj.strokeMiterLimit || 4;
    this.trimPathStart = obj.trimPathStart || 0;
    this.trimPathEnd = ('trimPathEnd' in obj && typeof obj.trimPathEnd == 'number')
        ? obj.trimPathEnd : 1;
    this.trimPathOffset = obj.trimPathOffset || 0;
  }

  computeBounds() {
    return Object.assign({}, (this.pathData && this.pathData.bounds) ? this.pathData.bounds : null);
  }

  get typeString() {
    return 'path';
  }

  get typeIdPrefix() {
    return 'path';
  }

  get typeIcon() {
    return 'path_layer';
  }

  toJSON() {
    return Object.assign(super.toJSON(), {
      pathData: this.pathData.pathString,
      fillColor: this.fillColor,
      fillAlpha: this.fillAlpha,
      strokeColor: this.strokeColor,
      strokeAlpha: this.strokeAlpha,
      strokeWidth: this.strokeWidth,
      strokeLinecap: this.strokeLinecap,
      strokeLinejoin: this.strokeLinejoin,
      strokeMiterLimit: this.strokeMiterLimit,
      trimPathStart: this.trimPathStart,
      trimPathEnd: this.trimPathEnd,
      trimPathOffset: this.trimPathOffset
    });
  }
}


const ENUM_LINECAP_OPTIONS = [
  {
    value: 'butt',
    label: 'Butt',
  },
  {
    value: 'square',
    label: 'Square',
  },
  {
    value: 'round',
    label: 'Round',
  }
];


const ENUM_LINEJOIN_OPTIONS = [
  {
    value: 'miter',
    label: 'Miter',
  },
  {
    value: 'round',
    label: 'Round',
  },
  {
    value: 'bevel',
    label: 'Bevel',
  }
];


Property.registerProperties(PathLayer, [
  {name: 'pathData', property: new PathDataProperty(), animatable: true},
  {name: 'fillColor', property: new ColorProperty(), animatable: true},
  {name: 'fillAlpha', property: new FractionProperty(), animatable: true},
  {name: 'strokeColor', property: new ColorProperty(), animatable: true},
  {name: 'strokeAlpha', property: new FractionProperty(), animatable: true},
  {name: 'strokeWidth', property: new NumberProperty({min:0}), animatable: true},
  {name: 'strokeLinecap', property: new EnumProperty(ENUM_LINECAP_OPTIONS)},
  {name: 'strokeLinejoin', property: new EnumProperty(ENUM_LINEJOIN_OPTIONS)},
  {name: 'strokeMiterLimit', property: new NumberProperty({min:1})},
  {name: 'trimPathStart', property: new FractionProperty(), animatable: true},
  {name: 'trimPathEnd', property: new FractionProperty(), animatable: true},
  {name: 'trimPathOffset', property: new FractionProperty(), animatable: true}
]);


/**
 * A group ('folder') containing other layers.
 */
export class LayerGroup extends BaseLayer {
  constructor(obj = {}, opts = {}) {
    super(obj, opts);
    this.layers = (obj.layers || []).map(obj => BaseLayer.load(obj, opts));
    this.rotation = obj.rotation || 0;
    this.scaleX = ('scaleX' in obj) ? obj.scaleX : 1;
    this.scaleY = ('scaleY' in obj) ? obj.scaleY : 1;
    this.pivotX = obj.pivotX || 0;
    this.pivotY = obj.pivotY || 0;
    this.translateX = obj.translateX || 0;
    this.translateY = obj.translateY || 0;
  }

  computeBounds() {
    let bounds = null;
    this.layers.forEach(child => {
      let childBounds = child.computeBounds();
      if (!childBounds) {
        return;
      }

      if (!bounds) {
        bounds = Object.assign({}, childBounds);
      } else {
        bounds.l = Math.min(childBounds.l, bounds.l);
        bounds.t = Math.min(childBounds.t, bounds.t);
        bounds.r = Math.max(childBounds.r, bounds.r);
        bounds.b = Math.max(childBounds.b, bounds.b);
      }
    });
    return bounds;
  }

  get layers() {
    return this.layers_ || [];
  }

  set layers(layers) {
    this.layers_ = layers;
    this.layers_.forEach(layer => layer.parent = this);
  }

  get typeString() {
    return 'group';
  }

  get typeIdPrefix() {
    return 'group';
  }

  get typeIcon() {
    return 'layer_group';
  }

  findLayerById(id) {
    for (let i = 0; i < this.layers.length; i++) {
      let layer = this.layers[i];
      if (layer.id === id) {
        return layer;
      } else if (layer.findLayerById) {
        layer = layer.findLayerById(id);
        if (layer) {
          return layer;
        }
      }
    }

    return null;
  }

  toJSON() {
    return Object.assign(super.toJSON(), {
      rotation: this.rotation,
      scaleX: this.scaleX,
      scaleY: this.scaleY,
      pivotX: this.pivotX,
      pivotY: this.pivotY,
      translateX: this.translateX,
      translateY: this.translateY,
      layers: this.layers.map(layer => layer.toJSON())
    });
  }
}


Property.registerProperties(LayerGroup, [
  {name: 'rotation', property: new NumberProperty(), animatable: true},
  {name: 'scaleX', property: new NumberProperty(), animatable: true},
  {name: 'scaleY', property: new NumberProperty(), animatable: true},
  {name: 'pivotX', property: new NumberProperty(), animatable: true},
  {name: 'pivotY', property: new NumberProperty(), animatable: true},
  {name: 'translateX', property: new NumberProperty(), animatable: true},
  {name: 'translateY', property: new NumberProperty(), animatable: true}
]);


/**
 * A mask layer (mask defined by a path) that clips/masks layers that follow it
 * within its layer group.
 */
export class MaskLayer extends BaseLayer {
  constructor(obj = {}, opts = {}) {
    super(obj, opts);
    this.pathData = obj.pathData || '';
  }

  computeBounds() {
    return Object.assign({}, (this.pathData && this.pathData.bounds) ? this.pathData.bounds : null);
  }

  get typeString() {
    return 'mask';
  }

  get typeIdPrefix() {
    return 'mask';
  }

  get typeIcon() {
    return 'mask_layer';
  }

  toJSON() {
    return Object.assign(super.toJSON(), {
      pathData: this.pathData.pathString
    });
  }
}


Property.registerProperties(MaskLayer, [
  {name: 'pathData', property: new PathDataProperty(), animatable: true}
]);


/**
 * An artwork is the root layer group for a vector, defined mostly by
 * a width, height, and its children.
 */
export class Artwork extends LayerGroup {
  constructor(obj = {}, opts = {}) {
    super(obj, opts);
    this.id = this.id || this.typeIdPrefix;
    this.canvasColor = obj.fillColor || null;
    this.width = obj.width || 100;
    this.height = obj.height || 100;
    this.alpha = obj.alpha || 1;
  }

  computeBounds() {
    return { l: 0, t: 0, r: this.width, b: this.height };
  }

  get typeString() {
    return 'artwork';
  }

  get typeIdPrefix() {
    return 'vector';
  }

  get typeIcon() {
    return 'artwork';
  }

  findLayerById(id) {
    if (this.id === id) {
      return this;
    }
    return super.findLayerById(id);
  }

  toJSON() {
    return {
      id: this.id,
      canvasColor: this.canvasColor,
      width: this.width,
      height: this.height,
      alpha: this.alpha,
      layers: this.layers.map(layer => layer.toJSON())
    };
  }
}


Property.registerProperties(Artwork, [
  {name: 'id', property: new IdProperty()},
  {name: 'canvasColor', property: new ColorProperty()},
  {name: 'width', property: new NumberProperty({min:4, max:1024, integer:true})},
  {name: 'height', property: new NumberProperty({min:4, max:1024, integer:true})},
  {name: 'alpha', property: new FractionProperty(), animatable: true},
], true);


/**
 * An animation represents a collection of layer property tweens for a given artwork.
 */
export class Animation {
  constructor(obj = {}) {
    this.id = obj.id || null;
    this.blocks = (obj.blocks || []).map(obj => new AnimationBlock(obj));
    this.duration = obj.duration || 100;
  }

  get blocks() {
    return this.blocks_ || [];
  }

  set blocks(blocks) {
    this.blocks_ = blocks;
    this.blocks_.forEach(block => block.parent = this);
  }

  get typeString() {
    return 'animation';
  }

  get typeIdPrefix() {
    return 'anim';
  }

  get typeIcon() {
    return 'animation';
  }

  toJSON() {
    return {
      id: this.id,
      duration: this.duration,
      blocks: this.blocks.map(block => block.toJSON())
    };
  }
}


Property.registerProperties(Animation, [
  {name: 'id', property: new IdProperty()},
  {name: 'duration', property: new NumberProperty({min:100, max:60000})}
]);


function valueToJson_(val) {
  if (typeof val == 'object' && 'toJSON' in val) {
    return val.toJSON();
  }

  return val;
}


/**
 * An animation block is an individual layer property tween (property animation).
 */
export class AnimationBlock {
  constructor(obj = {}) {
    this.layerId = obj.layerId || null;
    this.propertyName = obj.propertyName || null;
    let isPathData = (this.propertyName == 'pathData');
    if ('fromValue' in obj) {
      this.fromValue = isPathData ? new SvgPathData(obj.fromValue) : obj.fromValue;
    }
    this.toValue = isPathData ? new SvgPathData(obj.toValue) : obj.toValue;
    this.startTime = obj.startTime || 0;
    this.endTime = obj.endTime || 0;
    if (this.startTime > this.endTime) {
      let tmp = this.endTime;
      this.endTime = this.startTime;
      this.startTime = tmp;
    }
    this.interpolator = obj.interpolator || 'ACCELERATE_DECELERATE';
  }

  get typeString() {
    return 'block';
  }

  get typeIdPrefix() {
    return 'block';
  }

  get typeIcon() {
    return 'animation_block';
  }

  toJSON() {
    return {
      layerId: this.layerId,
      propertyName: this.propertyName,
      fromValue: valueToJson_(this.fromValue),
      toValue: valueToJson_(this.toValue),
      startTime: this.startTime,
      endTime: this.endTime,
      interpolator: this.interpolator.value,
    };
  }
}

const FAST_OUT_SLOW_IN_EASING = bezierEasing(.4, 0, .2, 1);
const FAST_OUT_LINEAR_IN_EASING = bezierEasing(.4, 0, 1, 1);
const LINEAR_OUT_SLOW_IN_EASING = bezierEasing(0, 0, .2, 1);

const ENUM_INTERPOLATOR_OPTIONS = [
  {
    value: 'ACCELERATE_DECELERATE',
    label: 'Accelerate/decelerate',
    androidRef: '@android:anim/accelerate_decelerate_interpolator',
    interpolate: f => Math.cos((f + 1) * Math.PI) / 2.0 + 0.5,
  },
  {
    value: 'ACCELERATE',
    label: 'Accelerate',
    androidRef: '@android:anim/accelerate_interpolator',
    interpolate: f => f * f,
  },
  {
    value: 'DECELERATE',
    label: 'Decelerate',
    androidRef: '@android:anim/decelerate_interpolator',
    interpolate: f => (1 - (1 - f) * (1 - f)),
  },
  {
    value: 'ANTICIPATE',
    label: 'Anticipate',
    androidRef: '@android:anim/anticipate_interpolator',
    interpolate: f => f * f * ((2 + 1) * f - 2),
  },
  {
    value: 'LINEAR',
    label: 'Linear',
    androidRef: '@android:anim/linear_interpolator',
    interpolate: f => f,
  },
  {
    value: 'OVERSHOOT',
    label: 'Overshoot',
    androidRef: '@android:anim/overshoot_interpolator',
    interpolate: f => (f - 1) * (f - 1) * ((2 + 1) * (f - 1) + 2) + 1
  },
  {
    value: 'FAST_OUT_SLOW_IN',
    label: 'Fast out, slow in',
    androidRef: '@android:interpolator/fast_out_slow_in',
    interpolate: f => FAST_OUT_SLOW_IN_EASING(f)
  },
  {
    value: 'FAST_OUT_LINEAR_IN',
    label: 'Fast out, linear in',
    androidRef: '@android:interpolator/fast_out_linear_in',
    interpolate: f => FAST_OUT_LINEAR_IN_EASING(f)
  },
  {
    value: 'LINEAR_OUT_SLOW_IN',
    label: 'Linear out, slow in',
    interpolate: f => LINEAR_OUT_SLOW_IN_EASING(f)
  },
];


Property.registerProperties(AnimationBlock, [
  {name: 'fromValue', property: 'auto'},
  {name: 'toValue', property: 'auto'},
  {name: 'startTime', property: new NumberProperty({min:0, integer:true})},
  {name: 'endTime', property: new NumberProperty({min:0, integer:true})},
  {name: 'interpolator', property: new EnumProperty(ENUM_INTERPOLATOR_OPTIONS, {storeEntireOption:true})}
]);


const LAYER_CLASSES_BY_TYPE = {
  'path': PathLayer,
  'group': LayerGroup,
  'mask': MaskLayer,
  'artwork': Artwork
};
