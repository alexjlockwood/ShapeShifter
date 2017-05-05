import { StubProperty } from '.';

/**
 * A property is used to decorate a model object so that it can be inspected
 * and/or animated. T is the value type being inspected and/or animated.
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
        if (prop instanceof StubProperty) {
          return;
        }
        // Create's a property with the specified property name.
        Object.defineProperty(cls.prototype, prop.propertyName, {
          get() {
            return prop.getter_(this, prop.propertyName);
          },
          set(value: any) {
            prop.setter_(this, prop.propertyName, value);
          }
        });
      });

      const animatableProperties = new Map<string, any>();
      const inspectableProperties = new Map<string, any>();
      const currAnimatableProperties = cls.prototype.animatableProperties as Map<string, any>;
      if (currAnimatableProperties) {
        currAnimatableProperties.forEach((v, k) => animatableProperties.set(k, v));
      }
      const currInspectableProperties = cls.prototype.animatableProperties as Map<string, any>;
      if (currInspectableProperties) {
        currInspectableProperties.forEach((v, k) => inspectableProperties.set(k, v));
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
    this.propertyName = name;
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
  trySetEditedValue(model: any, propertyName: string, value: T) {
    model[propertyName] = value;
  }

  /**
   * Gets the property's source of truth value.
   */
  protected getter_(model: any, propertyName: string): T {
    return model[`${propertyName}_`];
  }

  /**
   * Gets the property's source of truth value. This value is only changed when the user
   * finishes modifying an input in the UI.
   */
  protected setter_(model: any, propertyName: string, value: T) {
    model[`${propertyName}_`] = value;
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
