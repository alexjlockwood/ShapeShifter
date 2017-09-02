import { Command } from './Command';
import * as PathParser from './PathParser';

describe('PathParser', () => {
  it(`sub paths begin with lowercase 'm'`, () => {
    let path = 'm 9 7 -1 1 -8 -8 L 10 10 Z';
    let cmds = PathParser.parseCommands(path);
    let actual = cmds.map(cmd => commandToString(cmd)).join(' ');
    expect(actual).toEqual('M 9 7 L 8 8 L 0 0 L 10 10 Z');

    path = 'm -1 1 -15 0 0 -2 15 0 Z';
    cmds = PathParser.parseCommands(path);
    actual = cmds.map(cmd => commandToString(cmd)).join(' ');
    expect(actual).toEqual('M -1 1 L -16 1 L -16 -1 L -1 -1 Z');

    path = 'm 9 7 -1 1 -8 -8 L 10 10 Z m -1 1 -15 0 0 -2 15 0 Z';
    cmds = PathParser.parseCommands(path);
    actual = cmds.map(cmd => commandToString(cmd)).join(' ');
    expect(actual).toEqual('M 9 7 L 8 8 L 0 0 L 10 10 Z M 8 8 L -7 8 L -7 6 L 8 6 Z');
  });

  it('convert arcs to cubic bezier curves', () => {
    const path = 'M 0 0 A 5 5 0 1 0 10 0';
    const cmds = PathParser.parseCommands(path);
    const actual = cmds.map(cmd => commandToString(cmd)).join(' ');
    expect(actual).toEqual('M 0 0 C 5 5 C 10 0');
  });
});

function commandToString(c: Command) {
  if (c.getSvgChar() === 'Z') {
    return 'Z';
  }
  return `${c.getSvgChar()} ${c.getEnd().x} ${c.getEnd().y}`;
}
