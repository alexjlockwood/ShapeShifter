/* tslint:disable:max-line-length */

import { Command } from './Command';
import * as PathParser from './PathParser';
import * as PathParserOld from './PathParserOld';

class Test {
  constructor(readonly before: string, readonly after: string, readonly blacklist = false) {}
}

class Spec {
  readonly tests: ReadonlyArray<Test>;
  constructor(readonly description: string, ...tests: Test[]) {
    this.tests = tests;
  }
}

const specs = [
  new Spec(
    `sub paths begin with lowercase 'm'`,
    new Test(`m 9 7 -1 1 -8 -8 L 10 10 Z`, `M 9 7 L 8 8 L 0 0 L 10 10 Z`),
    new Test(`m -1 1 -15 0 0 -2 15 0 Z`, `M -1 1 L -16 1 L -16 -1 L -1 -1 Z`),
    new Test(
      `m 9 7 -1 1 -8 -8 L 10 10 Z m -1 1 -15 0 0 -2 15 0 Z`,
      `M 9 7 L 8 8 L 0 0 L 10 10 Z M 8 8 L -7 8 L -7 6 L 8 6 Z`,
    ),
  ),
  new Spec(
    `convert arcs to cubic bezier curves`,
    new Test(
      `M 0 0 A 5 5 0 1 0 10 0`,
      `M 0 0 C 0 1.326 0.527 2.598 1.464 3.536 C 2.402 4.473 3.674 5 5 5 C 6.326 5 7.598 4.473 8.536 3.536 C 9.473 2.598 10 1.326 10 0`,
      true,
    ),
  ),
  new Spec(
    `paths w/ complex arcs and curves`,
    new Test(
      `M54,9.422c-6.555,6.043-13.558,13.787-17.812,22.27C31.93,23.209,24.926,15.465,18.372,9.422a101.486,101.486,0,0,0,17.811,1.564A101.5,101.5,0,0,0,54,9.422M72.367,0A96.572,96.572,0,0,1,36.183,6.986,96.567,96.567,0,0,1,0,0S36.183,23.482,36.183,46.964C36.183,23.482,72.367,0,72.367,0Z`,
      `M 54 9.422 C 47.445 15.465 40.442 23.209 36.188 31.692 C 31.93 23.209 24.926 15.465 18.372 9.422 C 24.251 10.466 30.212 10.99 36.183 10.986 C 42.156 10.99 48.119 10.467 54 9.422 M 72.367 0 C 60.866 4.63 48.581 7.002 36.183 6.986 C 23.786 7.002 11.5 4.63 0 0 C 0 0 36.183 23.482 36.183 46.964 C 36.183 23.482 72.367 0 72.367 0 Z`,
      true,
    ),
    new Test(
      `M 10 80 C 38.333 33.333 66.666 33.333 95 80 T 180 80`,
      `M 10 80 C 38.333 33.333 66.666 33.333 95 80 Q 95 80 180 80`,
      true,
    ),
  ),
];

describe('PathParser', () => {
  for (const { description, tests } of specs) {
    it(description, () => {
      for (const { before, after, blacklist } of tests) {
        if (blacklist) {
          continue;
        }
        expect(PathParserOld.commandsToString(PathParserOld.parseCommands(before))).toEqual(after);
      }
    });
  }
});

describe('PathParser2', () => {
  for (const { description, tests } of specs) {
    it(description, () => {
      for (const { before, after } of tests) {
        expect(PathParser.commandsToString(PathParser.parseCommands(before))).toEqual(after);
      }
    });
  }
});
