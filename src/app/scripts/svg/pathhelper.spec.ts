import { } from 'jasmine';
import { PathHelper, Projection, createPathHelper } from './pathhelper';
import { Point } from '../common';

describe('PathHelper', () => {
  it('constructor', () => {
    expect([]).toEqual([]);
  });
});

function makePoints(...nums: number[]) {
  if (nums.length % 2 !== 0) {
    throw new Error('Invalid number of points');
  }
  const points = [];
  for (let i = 0; i < nums.length; i += 2) {
    points.push(new Point(nums[i], nums[i + 1]));
  }
  return points;
}
