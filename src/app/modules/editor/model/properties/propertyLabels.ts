import { upperFirst } from 'lodash-es';

// Where the UI calls a property something other than its name. It says opacity rather than alpha,
// as design tools do.
const LABELS: Readonly<Record<string, string>> = {
  alpha: 'opacity',
  fillAlpha: 'fill opacity',
  strokeAlpha: 'stroke opacity',
  pathData: 'path',
};

/**
 * Returns how the UI names a property, in lowercase for the middle of a sentence: e.g. 'stroke
 * color' for strokeColor, and 'scale X' for scaleX. Names are kept as they are in project files and
 * exports, so this is only for what the user reads.
 */
export function getPropertyLabel(propertyName: string) {
  return (
    LABELS[propertyName] ??
    propertyName
      .replace(/[A-Z]/g, letter => ` ${letter}`)
      .split(' ')
      .map(word => (word.length > 1 ? word.toLowerCase() : word))
      .join(' ')
  );
}

/** Returns the property's label on its own, e.g. 'Stroke color' in a menu. */
export function getPropertyTitle(propertyName: string) {
  return upperFirst(getPropertyLabel(propertyName));
}
