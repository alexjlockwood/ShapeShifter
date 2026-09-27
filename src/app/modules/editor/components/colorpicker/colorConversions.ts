import { ColorUtil } from 'app/modules/editor/scripts/common';
import { clamp } from 'lodash-es';
import type { RgbaColor } from 'react-colorful';

/**
 * The color the picker shows when there's nothing to convert, i.e. an empty or unparsable Android
 * color string. Opaque black gives the saturation square and the sliders a starting point.
 */
export const EMPTY_COLOR_RGBA: RgbaColor = { r: 0, g: 0, b: 0, a: 1 };

/**
 * Converts an Android color string (ColorUtil.toAndroidString's `#rrggbb` or `#aarrggbb`) into the
 * RGBA object react-colorful edits. Both use r, g, and b from 0-255, but Android's alpha is a byte
 * (0-255) and react-colorful's is a fraction (0-1). `''` or an unparsable string (no color) falls
 * back to EMPTY_COLOR_RGBA, so the picker always has a color to show and drag from.
 */
export function androidColorToRgba(value: string | undefined): RgbaColor {
  const parsed = value ? ColorUtil.parseAndroidColor(value) : undefined;
  if (!parsed) {
    return EMPTY_COLOR_RGBA;
  }
  return { r: parsed.r, g: parsed.g, b: parsed.b, a: parsed.a / 255 };
}

/**
 * Converts react-colorful's RGBA into an Android color string, the inverse of androidColorToRgba.
 * Rounds r, g, and b to integers and alpha back to a 0-255 byte, since drags can leave them
 * fractional.
 */
export function rgbaToAndroidColor(rgba: RgbaColor): string {
  return ColorUtil.toAndroidString({
    r: clamp(Math.round(rgba.r), 0, 0xff),
    g: clamp(Math.round(rgba.g), 0, 0xff),
    b: clamp(Math.round(rgba.b), 0, 0xff),
    a: clamp(Math.round(rgba.a * 0xff), 0, 0xff),
  });
}

/** The 6-digit RGB hex the panel's Hex field shows, without Android's alpha byte. */
export function androidColorToHex(value: string | undefined): string {
  const { r, g, b } = androidColorToRgba(value);
  return [r, g, b].map(channel => channel.toString(16).padStart(2, '0')).join('');
}

/** The 0-100 alpha percentage the panel's alpha field shows, rounded to the nearest integer. */
export function androidColorToAlphaPercent(value: string | undefined): number {
  return Math.round(androidColorToRgba(value).a * 100);
}

/**
 * Combines a 6-digit RGB hex string (as androidColorToHex returns) with a separate 0-100 alpha
 * percentage into an Android color string. The panel edits RGB and alpha in separate fields, so
 * each field's change needs the other field's current value to build the full color.
 */
export function hexAndAlphaPercentToAndroidColor(hex: string, alphaPercent: number): string {
  return rgbaToAndroidColor({
    r: parseInt(hex.substring(0, 2), 16),
    g: parseInt(hex.substring(2, 4), 16),
    b: parseInt(hex.substring(4, 6), 16),
    a: clamp(alphaPercent, 0, 100) / 100,
  });
}

/** Whether the text is exactly 6 hex digits, the only value the Hex field commits. */
export function isValidHex(hex: string): boolean {
  return /^[0-9a-fA-F]{6}$/.test(hex);
}

/** Whether the text is a whole number from 0 to 100, the only value the alpha field commits. */
export function isValidAlphaPercent(text: string): boolean {
  return /^\d+$/.test(text) && Number(text) <= 100;
}
