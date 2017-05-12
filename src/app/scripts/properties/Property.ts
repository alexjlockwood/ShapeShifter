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
    return function (cls: any) {
      props.forEach(prop => {
        // Create's a property with the specified property name.
        Object.defineProperty(cls.prototype, prop.propertyName, {
          get() {
            return this[`${prop.propertyName}_`];
          },
          set(value: any) {
            if (prop.propertyName === 'fillColor' && typeof value !== 'string') {
              throw new TypeError('invalid type!');
            }
            this[`${prop.propertyName}_`] = value;
          }
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

  constructor(
    private readonly propertyName: string,
    readonly config: Config = {},
  ) {
    this.isAnimatable = !!config.isAnimatable;
  }

  /**
   * Returns the property's editable value (the value keyed with the property's name).
   */
  getEditableValue(model: any, propertyName: string): T {
    return model[propertyName];
  }

  /**
   * Sets the property's editable value (the value keyed with the property's name).
   */
  setEditableValue(model: any, propertyName: string, value: T) {
    model[propertyName] = value;
  }

  /**
   * Returns an interpolated value between start and end using the specified fraction.
   * This method does not modify the property's internal state.
   */
  interpolateValue(start: T, end: T, fraction: number) {
    return undefined;
  }

  /**
   * Returns a string representation of the value for display in the UI.
   */
  displayValueForValue(value: T) {
    return '';
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
}

export interface Config {
  readonly isAnimatable?: boolean;
}
