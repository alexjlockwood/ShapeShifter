import { StubProperty } from '.';

// TODO: convert animatable/inspectable property objects into Maps?
export class Property<T> {
  private readonly animatable: boolean;

  /**
   * Builds a decorator factory for the specified properties.
   */
  static register(...props: Property<any>[]) {
    return function (cls: any) {
      props.forEach(prop => {
        if (!(prop instanceof StubProperty)) {
          Object.defineProperty(cls.prototype, prop.name, {
            get() {
              return prop.getter_(this, prop.name);
            },
            set(value) {
              prop.setter_(this, prop.name, value);
            }
          });
        }
      });

      const animatableProperties = {};
      const inspectableProperties = {};

      Object.assign(animatableProperties, cls.prototype.animatableProperties);
      Object.assign(inspectableProperties, cls.prototype.inspectableProperties);

      props.forEach(prop => {
        if (prop.animatable) {
          animatableProperties[prop.name] = prop;
        }
        inspectableProperties[prop.name] = prop;
      });

      Object.defineProperty(cls.prototype, 'animatableProperties', {
        get: () => Object.assign({}, animatableProperties)
      });

      Object.defineProperty(cls.prototype, 'inspectableProperties', {
        get: () => Object.assign({}, inspectableProperties)
      });
    };
  }

  constructor(
    protected readonly name: string,
    readonly config: Config = {},
  ) {
    this.animatable = !!config.animatable;
  }

  interpolateValue(start: T, end: T, fraction: number) {
    return start;
  }

  getEditableValue(obj: any, propertyName: string): T {
    return obj[propertyName];
  }

  trySetEditedValue(obj: any, propertyName: string, value: T) {
    obj[propertyName] = value;
  }

  getter_(obj: any, propertyName: string): T {
    return obj[`${propertyName}_`];
  }

  setter_(obj: any, propertyName: string, value: T) {
    obj[`${propertyName}_`] = value;
  }

  displayValueForValue(value: T) {
    return '';
  }

  cloneValue(value: T) {
    return value;
  }
}

export interface Config {
  readonly animatable?: boolean;
}
