import { ColorUtil } from '.';

describe('ColorUtil', () => {
  const TESTS_ANDROID_RAW = [
    ['#f000', { r: 0, g: 0, b: 0, a: 255 } as ColorFormats.RGBA, '#000000'],
    ['f00', { r: 255, g: 0, b: 0, a: 255 } as ColorFormats.RGBA, '#ff0000'],
    ['#7f00ff00', { r: 0, g: 255, b: 0, a: 127 } as ColorFormats.RGBA, '#7f00ff00'],
    ['an invalid color', undefined],
  ];

  const TESTS_ANDROID_CSS = [
    ['#f000', '#000000', '#000000'],
    ['f00', '#ff0000', '#ff0000'],
    ['#7f00ff00', '#00ff007f', '#7f00ff00'],
    ['', 'transparent', '#00000000'],
  ];

  describe('#parseAndroidColor', () => {
    TESTS_ANDROID_RAW.forEach(a => {
      it(`parsing '${a[0]}' yields ${JSON.stringify(a[1])}`, () => {
        expect(ColorUtil.parseAndroidColor(a[0] as string)).toEqual(a[1] as ColorFormats.RGBA);
      });
    });
  });

  describe('#toAndroidString', () => {
    TESTS_ANDROID_RAW.forEach(a => {
      if (a[1]) {
        it(`converting ${JSON.stringify(a[1])} to string yields '${a[2]}'`, () => {
          expect(ColorUtil.toAndroidString(a[1] as ColorFormats.RGBA)).toEqual(a[2] as string);
        });
      }
    });
  });

  describe('#androidToCssColor', () => {
    TESTS_ANDROID_CSS.forEach(a => {
      it(`converting '${a[0]}' to CSS color yields '${a[1]}'`, () => {
        expect(ColorUtil.androidToCssHexColor(a[0])).toEqual(a[1]);
      });
    });
  });

  describe('#svgToAndroidColor', () => {
    TESTS_ANDROID_CSS.forEach(a => {
      it(`converting '${a[1]}' to Android color yields '${a[2]}'`, () => {
        expect(ColorUtil.svgToAndroidColor(a[1])).toEqual(a[2]);
      });
    });
  });
});
