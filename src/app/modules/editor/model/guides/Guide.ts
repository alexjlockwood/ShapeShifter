import { round, uniqueId } from 'lodash-es';

/**
 * A guide dragged out of a ruler: a vertical line at x = value (axis 'x'), or a horizontal one at
 * y = value, in viewport units. Guides help lay out the canvas, so they're saved in the
 * .shapeshifter file but never exported.
 */
export interface Guide {
  readonly id: string;
  readonly axis: 'x' | 'y';
  readonly value: number;
}

/** Guides keep the precision that paths do (commandsToString rounds to 3 decimals). */
export function roundGuideValue(value: number) {
  return round(value, 3);
}

/**
 * Reads the guides saved in a project, skipping any that aren't valid, since project files aren't
 * validated up front. Each gets a new id, like the layers do when a project is loaded.
 */
export function parseGuides(json: unknown): Guide[] {
  if (!Array.isArray(json)) {
    return [];
  }
  const guides: Guide[] = [];
  for (const item of json) {
    const { axis, value } = (item ?? {}) as { axis?: unknown; value?: unknown };
    if ((axis === 'x' || axis === 'y') && typeof value === 'number' && Number.isFinite(value)) {
      guides.push({ id: uniqueId(), axis, value: roundGuideValue(value) });
    }
  }
  return guides;
}

/** Returns the guides as they're saved in a project, without their ids. */
export function guidesToJSON(guides: ReadonlyArray<Guide>) {
  return guides.map(({ axis, value }) => ({ axis, value }));
}
