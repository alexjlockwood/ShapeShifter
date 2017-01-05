import { } from 'jasmine';
import * as PathParser from './pathparser';
import { CommandListBuilder } from './testutil';
import { SvgPathData } from './svgpathdata';

describe('SvgPathData', () => {
  // TODO(alockwood): this test fails!
  // it('reverse: M 0 0 L 10 10 L 20 20 L 30 30', () => {
  //   const actual = new SvgPathData("M 0 0 L 10 10 L 20 20 L 30 30");
  //   actual.reverse();
  //   const expected = new SvgPathData("M 30 30 L 20 20 L 10 10 L 0 0");
  //   expect(actual).toEqual(expected);
  // });

  it('reverse: M 0 0 L 10 10 L 20 20 L 30 30 Z', () => {
    const actual = new SvgPathData("M 0 0 L 10 10 L 20 20 L 30 30 Z");
    actual.reverse();
    const expected = new SvgPathData("M 0 0 L 30 30 L 20 20 L 10 10 Z");
    expect(actual).toEqual(expected);
  });
});
