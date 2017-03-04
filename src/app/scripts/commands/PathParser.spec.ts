import 'jasmine';
import * as PathParser from './PathParser';
import { Command } from '.';

describe('PathParser', () => {
  it(`Sub paths begin with lowercase 'm'`, () => {
    const path = 'm 9 7 -1 1 -8 -8 L 10 10 Z';
    const cmds = PathParser.parseCommands(path);
    const actual = cmds.map(cmd => commandToString(cmd)).join(' ');
    expect(actual).toEqual('M 9 7 L 8 8 L 0 0 L 10 10 Z');
  });

  it(`Sub paths begin with lowercase 'm'`, () => {
    const path = 'm -1 1 -15 0 0 -2 15 0 Z';
    const cmds = PathParser.parseCommands(path);
    const actual = cmds.map(cmd => commandToString(cmd)).join(' ');
    expect(actual).toEqual('M -1 1 L -16 1 L -16 -1 L -1 -1 Z');
  });

  it(`Sub paths begin with lowercase 'm'`, () => {
    const path = 'm 9 7 -1 1 -8 -8 L 10 10 Z m -1 1 -15 0 0 -2 15 0 Z';
    const cmds = PathParser.parseCommands(path);
    const actual = cmds.map(cmd => commandToString(cmd)).join(' ');
    expect(actual).toEqual('M 9 7 L 8 8 L 0 0 L 10 10 Z M 8 8 L -7 8 L -7 6 L 8 6 Z');
  });
});

function commandToString(c: Command) {
  if (c.svgChar === 'Z') {
    return 'Z';
  }
  return `${c.svgChar} ${c.end.x} ${c.end.y}`;
}
