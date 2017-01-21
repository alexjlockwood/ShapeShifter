import * as _ from 'lodash';
import { Point } from '../common';
import { PathCommand, SubPathCommand, DrawCommand } from '../model';

/**
 * Implementation of the SubPathCommand interface. A PathCommand is split up
 * into multiple SubPathCommands, each beginning with a 'move to' draw command.
 */
class SubPathCommandImpl implements SubPathCommand {

  // TODO: make sure paths with one M and multiple Zs are treated as multiple sub paths
  private readonly drawCommands_: ReadonlyArray<DrawCommand>;
  private readonly points_: ReadonlyArray<{ point: Point, isSplit: boolean }>;

  constructor(commands: DrawCommand[]) {
    this.drawCommands_ = commands;
    this.points_ = _.flatMap(commands, cmd => {
      if (cmd.svgChar === 'Z') {
        return [];
      }
      return [{ point: _.last(cmd.points), isSplit: !!cmd.isSplit }];
    });
  }

  // Implements the SubPathCommand interface.
  get commands(): ReadonlyArray<DrawCommand> {
    return this.drawCommands_;
  }

  // Implements the SubPathCommand interface.
  get isClosed() {
    const start = this.commands[0].end;
    const end = _.last(this.commands).end;
    const result = start.equals(end);
    const nearZero = 0.000001;
    if (Math.abs(start.x - end.x) < nearZero
      && Math.abs(start.y - end.y) < nearZero
      && !result) {
      console.warn('subpath should probably be closed', start, end);
    }
    return result;
  }

  // Implements the SubPathCommand interface.
  get points() {
    return this.points_;
  }
}

export function createSubPathCommand(...commands: DrawCommand[]): SubPathCommand {
  return new SubPathCommandImpl(commands);
}
