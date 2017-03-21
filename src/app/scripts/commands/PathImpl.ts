import * as _ from 'lodash';
import { MathUtil, Point } from '../common';
import { Path, Command, ProjectionResult, HitOptions } from '.';
import { PathState } from './PathState';
import { PathMutator } from './PathMutator';
import * as PathParser from './PathParser';

export function newPath(obj: string | Command[]): Path {
  return new PathImpl(obj);
}

/**
 * Implementation of the Path interface. Represents all of the information
 * associated with a path layer's pathData attribute.
 */
export class PathImpl implements Path {
  private readonly ps: PathState;
  private pathString: string;

  constructor(obj: string | Command[] | PathState) {
    if (typeof obj === 'string' || Array.isArray(obj)) {
      this.ps = new PathState(obj);
    } else {
      this.ps = obj;
    }
  }

  // Implements the Path interface.
  getPathString() {
    if (this.pathString === undefined) {
      this.pathString = PathParser.commandsToString(this.getCommands());
    }
    return this.pathString;
  }

  // Implements the Path interface.
  getSubPaths() {
    return this.ps.subPaths;
  }

  // Implements the Path interface.
  getCommands() {
    return this.ps.commands;
  }

  // Implements the Path interface.
  getPathLength() {
    return this.ps.getPathLength();
  }

  // Implements the Path interface.
  isMorphableWith(path: Path) {
    const cmds1 = this.getCommands();
    const cmds2 = path.getCommands();
    return cmds1.length === cmds2.length && cmds1.every((cmd1, i) =>
      cmd1.getSvgChar() === cmds2[i].getSvgChar());
  }

  // Implements the Path interface.
  interpolate(start: Path, end: Path, fraction: number): Path {
    if (!this.isMorphableWith(start) || !this.isMorphableWith(end)) {
      return this;
    }
    const newCommands: Command[] = [];
    this.getCommands().forEach((currCmd, i) => {
      const startCmd = start.getCommands()[i];
      const endCmd = end.getCommands()[i];
      const points: Point[] = [];
      for (let j = 0; j < currCmd.getPoints().length; j++) {
        const p1 = startCmd.getPoints()[j];
        const p2 = endCmd.getPoints()[j];
        if (p1 && p2) {
          // The 'start' point of the first Move command in a path
          // will be undefined. Skip it.
          const px = MathUtil.lerp(p1.x, p2.x, fraction);
          const py = MathUtil.lerp(p1.y, p2.y, fraction);
          points.push(new Point(px, py));
        }
      }
      // TODO: avoid re-generating unique ids on each animation frame.
      newCommands.push(currCmd.mutate().setId('').setPoints(...points).build());
    });
    return new PathImpl(newCommands);
  }

  // Implements the Path interface.
  project(point: Point):
    { projection: ProjectionResult, subIdx: number, cmdIdx: number } | undefined {
    return this.ps.project(point);
  }

  // Implements the Path interface.
  hitTest(point: Point, opts: HitOptions = {}) {
    return this.ps.hitTest(point, opts);
  }

  // Implements the Path interface.
  mutate() {
    return new PathMutator(this.ps);
  }

  // Implements the Path interface.
  clone() {
    return this.mutate().build();
  }
}
