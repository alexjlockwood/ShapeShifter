// TODO(alockwood): convert to typescript

import {ColorUtil} from './colorutil';
import {SvgPathData} from './svgpathdata';


export class Property {
  interpolateValue(start, end, f) {
    return start;
  }

  getEditableValue(obj, propertyName) {
    return obj[propertyName];
  }

  trySetEditedValue(obj, propertyName, value) {
    obj[propertyName] = value;
  }

  getter_(obj, propertyName, value) {
    let backingPropertyName = `${propertyName}_`;
    return obj[backingPropertyName];
  }

  setter_(obj, propertyName, value) {
    let backingPropertyName = `${propertyName}_`;
    obj[backingPropertyName] = value;
  }

  displayValueForValue(val) {
    return val;
  }

  cloneValue(val) {
    return val;
  }

  static registerProperties(cls, props, reset = false) {
    props.forEach(prop => {
      let propertyObj = prop.property;
      if (propertyObj instanceof Property) {
        Object.defineProperty(cls.prototype, prop.name, {
          get() {
            return propertyObj.getter_(this, prop.name);
          },
          set(value) {
            propertyObj.setter_(this, prop.name, value);
          }
        });
      }
    });

    let animatableProperties = {};
    let inspectableProperties = {};

    if (!reset) {
      Object.assign(animatableProperties, cls.prototype.animatableProperties);
      Object.assign(inspectableProperties, cls.prototype.inspectableProperties);
    }

    props.forEach(p => {
      if (p.animatable) {
        animatableProperties[p.name] = p.property;
      }

      if (!p.inspectable) {
        inspectableProperties[p.name] = p.property;
      }
    });

    Object.defineProperty(cls.prototype, 'animatableProperties', {
      get: () => Object.assign({}, animatableProperties)
    });

    Object.defineProperty(cls.prototype, 'inspectableProperties', {
      get: () => Object.assign({}, inspectableProperties)
    });
  }
}


export class EnumProperty extends Property {
  constructor(options, extra) {
    super();
    this.optionsByValue_ = {};
    this.options_ = (options || []).map(option => {
      let newOption = {};
      if (typeof option === 'string') {
        newOption = {
          value: option,
          label: option
        };
        option = newOption;
      }

      if (!('label' in option)) {
        option.label = option.value;
      }

      this.optionsByValue_[option.value] = option;
      return option;
    });

    extra = extra || {};
    if (extra.storeEntireOption) {
      this.storeEntireOption = extra.storeEntireOption;
    }
  }

  getter_(obj, propertyName, value) {
    let backingPropertyName = `${propertyName}_`;
    return obj[backingPropertyName];
  }

  setter_(obj, propertyName, value) {
    let backingPropertyName = `${propertyName}_`;

    obj[backingPropertyName] = this.storeEntireOption
        ? this.getOptionForValue_(value)
        : this.getOptionForValue_(value).value;
  }

  getOptionForValue_(value) {
    if (!value) {
      return null;
    }

    if (typeof value === 'string') {
      return this.optionsByValue_[value];
    } else if ('value' in value) {
      return value;
    }

    return null;
  }

  displayValueForValue(value) {
    if (!value) {
      return '';
    }

    return this.getOptionForValue_(value).label;
  }

  get options() {
    return this.options_;
  }
}


export class StringProperty extends Property {
}


export class IdProperty extends Property {
  trySetEditedValue(obj, propertyName, value) {
    obj[propertyName] = IdProperty.sanitize(value);
  }

  static sanitize(value) {
    value = (value || '')
        .toLowerCase()
        .replace(/^\s+|\s+$/g, '')
        .replace(/[\s-]+/g, '_')
        .replace(/[^\w_]+/g, '');
    return value;
  }
}


export class PathDataProperty extends Property {
  interpolateValue(start, end, f) {
    return SvgPathData.interpolate(start, end, f);
  }

  displayValueForValue(val) {
    return val.pathString;
  }

  getEditableValue(obj, propertyName) {
    return obj[propertyName] ? obj[propertyName].pathString : '';
  }

  trySetEditedValue(obj, propertyName, stringValue) {
    obj[propertyName] = new SvgPathData(stringValue);
  }

  getter_(obj, propertyName) {
    let backingPropertyName = `${propertyName}_`;
    return obj[backingPropertyName];
  }

  setter_(obj, propertyName, value) {
    let backingPropertyName = `${propertyName}_`;
    let pathData;
    if (!value || value instanceof SvgPathData) {
      pathData = value;
    } else {
      pathData = new SvgPathData(value);
    }

    obj[backingPropertyName] = pathData;
  }

  cloneValue(val) {
    return JSON.parse(JSON.stringify(val));
  }

  get animatorValueType() {
    return 'pathType';
  }
}


export class ColorProperty extends Property {
  interpolateValue(start, end, f) {
    start = ColorUtil.parseAndroidColor(start);
    end = ColorUtil.parseAndroidColor(end);
    return ColorUtil.toAndroidString({
      r: Math.max(0, Math.min(Math.round(simpleInterpolate_(start.r, end.r, f)), 255)),
      g: Math.max(0, Math.min(Math.round(simpleInterpolate_(start.g, end.g, f)), 255)),
      b: Math.max(0, Math.min(Math.round(simpleInterpolate_(start.b, end.b, f)), 255)),
      a: Math.max(0, Math.min(Math.round(simpleInterpolate_(start.a, end.a, f)), 255))
    });
  }

  trySetEditedValue(obj, propertyName, value) {
    if (!value) {
      obj[propertyName] = null;
      return;
    }

    let processedValue = ColorUtil.parseAndroidColor(value);
    if (!processedValue) {
      processedValue = ColorUtil.parseAndroidColor(ColorUtil.svgToAndroidColor(value));
    }

    obj[propertyName] = ColorUtil.toAndroidString(processedValue);
  }

  get animatorValueType() {
    return 'colorType';
  }
}


export class NumberProperty extends Property {
  constructor(opts = {}) {
    super();
    this.opts = opts;
  }

  trySetEditedValue(obj, propertyName, value) {
    value = parseFloat(value);
    if (!isNaN(value)) {
      if ('min' in this.opts) {
        value = Math.max(this.opts.min, value);
      }
      if ('max' in this.opts) {
        value = Math.min(this.opts.max, value);
      }
      if (this.opts.integer) {
        value = Math.floor(value);
      }
      obj[propertyName] = value;
    }
  }

  displayValueForValue(value) {
    if (typeof value === 'number') {
      return (Number.isInteger(value)
            ? value.toString()
            : Number(value.toFixed(3)).toString())
          .replace(/-/g, '\u2212');
    }
    return value;
  }

  setter_(obj, propertyName, value) {
    if (typeof value === 'string') {
      value = Number(value);
    }

    if (typeof value === 'number') {
      if (!isNaN(value)) {
        if ('min' in this.opts) {
          value = Math.max(this.opts.min, value);
        }
        if ('max' in this.opts) {
          value = Math.min(this.opts.max, value);
        }
        if (this.opts.integer) {
          value = Math.floor(value);
        }
      }
    }

    let backingPropertyName = `${propertyName}_`;
    obj[backingPropertyName] = value;
  }

  interpolateValue(start, end, f) {
    return simpleInterpolate_(start, end, f);
  }

  get animatorValueType() {
    return 'floatType';
  }
}


export class FractionProperty extends NumberProperty {
  constructor(opts = {}) {
    opts.min = 0;
    opts.max = 1;
    super(opts);
  }

  get animatorValueType() {
    return 'floatType';
  }
}


function simpleInterpolate_(start, end, f) {
  return start + (end - start) * f;
}
