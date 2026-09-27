import { parseAndroidColor } from 'app/modules/editor/scripts/common/ColorUtil';

// WCAG 2 relative luminance: https://www.w3.org/TR/WCAG21/#dfn-relative-luminance.
function toLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function relativeLuminance(color: string): number {
  const rgba = parseAndroidColor(color.replace(/^#/, ''));
  if (!rgba) {
    throw new Error(`Not a color: ${color}`);
  }
  return 0.2126 * toLinear(rgba.r) + 0.7152 * toLinear(rgba.g) + 0.0722 * toLinear(rgba.b);
}

/**
 * The WCAG 2 contrast ratio between two opaque colors (hex strings, with or without a leading
 * '#'), from 1 (no contrast) to 21 (black on white). Text needs at least 4.5, and icons and other
 * graphics need at least 3 (WCAG 2.1 success criteria 1.4.3 and 1.4.11).
 */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}
