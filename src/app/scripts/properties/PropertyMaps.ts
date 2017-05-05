import { Property } from '.';

export interface Inspectable {
  readonly inspectableProperties: Map<string, Property<any>>;
}

export interface Animatable {
  readonly animatableProperties: Map<string, Property<any>>;
}
