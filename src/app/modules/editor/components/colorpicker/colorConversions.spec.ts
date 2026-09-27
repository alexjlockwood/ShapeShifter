import {
  androidColorToAlphaPercent,
  androidColorToHex,
  androidColorToRgba,
  EMPTY_COLOR_RGBA,
  hexAndAlphaPercentToAndroidColor,
  isValidAlphaPercent,
  isValidHex,
  rgbaToAndroidColor,
} from './colorConversions';

describe('colorConversions', () => {
  describe('#androidColorToRgba', () => {
    it('converts an opaque color', () => {
      expect(androidColorToRgba('#ff0000')).toEqual({ r: 255, g: 0, b: 0, a: 1 });
    });

    it('converts a translucent color, rounding alpha to the 0-1 range react-colorful uses', () => {
      expect(androidColorToRgba('#7f00ff00')).toEqual({ r: 0, g: 255, b: 0, a: 127 / 255 });
    });

    it('falls back to opaque black for no color', () => {
      expect(androidColorToRgba('')).toEqual(EMPTY_COLOR_RGBA);
      expect(androidColorToRgba(undefined)).toEqual(EMPTY_COLOR_RGBA);
    });

    it('falls back to opaque black for an unparsable color', () => {
      expect(androidColorToRgba('not a color')).toEqual(EMPTY_COLOR_RGBA);
    });
  });

  describe('#rgbaToAndroidColor', () => {
    it('writes an opaque color without an alpha byte', () => {
      expect(rgbaToAndroidColor({ r: 255, g: 0, b: 0, a: 1 })).toBe('#ff0000');
    });

    it('writes a translucent color with an alpha byte first', () => {
      expect(rgbaToAndroidColor({ r: 0, g: 255, b: 0, a: 127 / 255 })).toBe('#7f00ff00');
    });

    it('rounds fractional channels and clamps out-of-range ones', () => {
      expect(rgbaToAndroidColor({ r: 254.6, g: -10, b: 300, a: 1 })).toBe('#ff00ff');
    });

    it('round-trips with androidColorToRgba', () => {
      const color = '#7f2962ff';
      expect(rgbaToAndroidColor(androidColorToRgba(color))).toBe(color);
    });
  });

  describe('#androidColorToHex', () => {
    it('drops the alpha byte', () => {
      expect(androidColorToHex('#7f2962ff')).toBe('2962ff');
    });

    it('returns black for no color', () => {
      expect(androidColorToHex('')).toBe('000000');
    });
  });

  describe('#androidColorToAlphaPercent', () => {
    it('converts an alpha byte to a percentage', () => {
      expect(androidColorToAlphaPercent('#7f2962ff')).toBe(50);
      expect(androidColorToAlphaPercent('#2962ff')).toBe(100);
    });

    it('returns 100 for no color, since the fallback color is opaque', () => {
      expect(androidColorToAlphaPercent('')).toBe(100);
    });
  });

  describe('#hexAndAlphaPercentToAndroidColor', () => {
    it('combines a hex string and an alpha percentage', () => {
      // 50% of 255 rounds up to 128 (0x80), not 127 (0x7f).
      expect(hexAndAlphaPercentToAndroidColor('2962ff', 50)).toBe('#802962ff');
    });

    it('omits the alpha byte at 100%', () => {
      expect(hexAndAlphaPercentToAndroidColor('2962ff', 100)).toBe('#2962ff');
    });

    it('clamps an out-of-range percentage', () => {
      expect(hexAndAlphaPercentToAndroidColor('2962ff', 150)).toBe('#2962ff');
      expect(hexAndAlphaPercentToAndroidColor('2962ff', -10)).toBe('#002962ff');
    });
  });

  describe('#isValidHex', () => {
    it('accepts exactly 6 hex digits', () => {
      expect(isValidHex('2962ff')).toBe(true);
      expect(isValidHex('2962FF')).toBe(true);
    });

    it('rejects anything else', () => {
      expect(isValidHex('2962f')).toBe(false);
      expect(isValidHex('2962ff0')).toBe(false);
      expect(isValidHex('2962fg')).toBe(false);
      expect(isValidHex('')).toBe(false);
    });
  });

  describe('#isValidAlphaPercent', () => {
    it('accepts whole numbers from 0 to 100', () => {
      expect(isValidAlphaPercent('0')).toBe(true);
      expect(isValidAlphaPercent('100')).toBe(true);
      expect(isValidAlphaPercent('50')).toBe(true);
    });

    it('rejects anything above 100 or non-numeric text', () => {
      expect(isValidAlphaPercent('101')).toBe(false);
      expect(isValidAlphaPercent('')).toBe(false);
      expect(isValidAlphaPercent('-1')).toBe(false);
      expect(isValidAlphaPercent('abc')).toBe(false);
    });
  });
});
