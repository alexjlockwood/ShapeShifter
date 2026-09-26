import { FractionProperty, NumberProperty, Property } from 'app/modules/editor/model/properties';

export interface StepOptions {
  readonly up: boolean;
  readonly shiftKey: boolean;
  readonly modifierKey: boolean;
}

/**
 * Returns the value that pressing Up or Down in a property's text field steps to, or undefined if
 * the arrows shouldn't change it. Only number fields step. Color, name, and path fields used to
 * step too, since `Number('')` is 0: an empty color turned black, an empty name threw, and an
 * empty path was replaced with a number, which broke drawing and exporting.
 */
export function getSteppedValue(property: Property<any>, text: string, options: StepOptions) {
  if (!(property instanceof NumberProperty) || !text.trim()) {
    return undefined;
  }
  const numberValue = Number(text);
  if (isNaN(numberValue)) {
    return undefined;
  }
  let delta = options.up ? 1 : -1;
  if (property instanceof FractionProperty) {
    delta *= 0.1;
  }
  if (options.shiftKey) {
    // TODO: make this more obvious somehow
    delta *= 10;
  } else if (options.modifierKey) {
    // TODO: make this more obvious somehow
    delta /= 10;
  }
  return Number((numberValue + delta).toFixed(6));
}
