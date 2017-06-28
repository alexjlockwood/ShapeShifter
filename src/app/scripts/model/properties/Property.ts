/**
 * A property is used to decorate a model object so that it can be inspected
 * and/or animated. T is the value type that is stored inside the model object.
 *
 * Model objects decorated with a property are given the following:
 *
 * - A getter/setter that can be accessed using the property's name.
 * - An 'inspectableProperties' object mapping string property names
 *   to their corresponding inspectable property objects.
 * - An 'animatableProperties' object mapping string property names
 *   to their corresponding animatable property objects.
 */
export abstract class Property<T> {
  private readonly isAnimatable: boolean;

  /**
   * Builds a decorator factory for the specified properties.
   */
  static register(...props: Property<any>[]) {
    return function(cls: any) {
      props.forEach(prop => {
        // Create's a property with the specified property name.
        Object.defineProperty(cls.prototype, prop.propertyName, {
          get() {
            return prop.getter(this, prop.propertyName);
          },
          set(value: any) {
            prop.setter(this, prop.propertyName, value);
          },
        });
      });

      let animatableProperties = new Map<string, Property<any>>();
      if (cls.prototype.animatableProperties) {
        animatableProperties = new Map<string, Property<any>>(cls.prototype.animatableProperties);
      }
      let inspectableProperties = new Map<string, Property<any>>();
      if (cls.prototype.inspectableProperties) {
        inspectableProperties = new Map<string, Property<any>>(cls.prototype.inspectableProperties);
      }

      props.forEach(prop => {
        if (prop.isAnimatable) {
          animatableProperties.set(prop.propertyName, prop);
        }
        inspectableProperties.set(prop.propertyName, prop);
      });

      Object.defineProperty(cls.prototype, 'animatableProperties', {
        get: () => new Map(animatableProperties),
      });

      Object.defineProperty(cls.prototype, 'inspectableProperties', {
        get: () => new Map(inspectableProperties),
      });
    };
  }

  constructor(private readonly propertyName: string, config: Config = {}) {
    this.isAnimatable = !!config.isAnimatable;
  }

  getEditableValue(model: any, propertyName: string) {
    return model[propertyName];
  }

  setEditableValue(model: any, propertyName: string, value) {
    model[propertyName] = value;
  }

  protected getter(model: any, propertyName: string) {
    return model[`${propertyName}_`];
  }

  protected setter(model: any, propertyName: string, value) {
    model[`${propertyName}_`] = value;
  }

  displayValueForValue(value) {
    return value;
  }

  /**
   * Returns an interpolated value between start and end using the specified fraction.
   * This method does not modify the property's internal state, but rather
   * returns a newly created object.
   */
  interpolateValue(start: T, end: T, fraction: number) {
    return start;
  }

  /**
   * Returns a cloned instance of the value.
   */
  cloneValue(value: T) {
    return value;
  }

  /**
   * Returns the animator value type for used in Android AnimatedVectorDrawable files.
   */
  getAnimatorValueType() {
    return '';
  }

  abstract getTypeName(): string;
}

export interface Config {
  readonly isAnimatable?: boolean;
}
