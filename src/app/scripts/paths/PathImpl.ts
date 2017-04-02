import { Point } from '../common';
import {
  Path, Command, ProjectionOntoPath, HitOptions, HitResult
} from '.';
import { PathState } from './PathState';
import { PathMutator } from './PathMutator';
import * as PathParser from './PathParser';

export function newPath(obj: string | Command[] | PathState): Path {
  return new PathImpl(obj);
}

/**
 * Implementation of the Path interface.
 */
class PathImpl implements Path {
  private readonly ps: PathState;
  private pathString: string;
  private poleOfInaccessibility: Point;

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
  project(point: Point, allowedSubIdx?: number): ProjectionOntoPath | undefined {
    return this.ps.project(point, allowedSubIdx);
  }

  // Implements the Path interface.
  hitTest(point: Point, opts: HitOptions): HitResult {
    return this.ps.hitTest(point, opts);
  }

  // Implements the Path interface.
  getPoleOfInaccessibility(subIdx: number) {
    if (!this.poleOfInaccessibility) {
      this.poleOfInaccessibility = this.ps.getPoleOfInaccessibility(subIdx);
    }
    return this.poleOfInaccessibility;
  }

  // Implements the Path interface.
  mutate() {
    return new PathMutator(this.ps);
  }

  // Implements the Path interface.
  clone() {
    return this.mutate().build();
  }

  // Implements the Path interface.
  revert() {
    return this.mutate().revert().build();
  }
}
