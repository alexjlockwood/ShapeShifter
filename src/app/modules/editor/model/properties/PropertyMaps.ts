import { Property } from '.';

// Maps property names to inspectable properties.
export interface Inspectable {
  readonly inspectableProperties: Map<string, Property<any>>;
}

// Maps property names to animatable properties.
export interface Animatable {
  readonly animatableProperties: Map<string, Property<any>>;
}
