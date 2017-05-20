import * as _ from 'lodash';
import { Point } from '../common';
import {
  Path, Command, ProjectionOntoPath, HitOptions, HitResult, Line
} from '.';
import { PathState } from './PathState';
import { PathMutator } from './PathMutator';
import * as PathParser from './PathParser';
import { environment } from '../../../environments/environment';

export function newPath(obj: string | Command[] | PathState): Path {
  return new PathImpl(obj);
}

/**
 * Implementation of the Path interface.
 */
class PathImpl implements Path {
  private readonly ps: PathState;
  private pathString: string;

  constructor(obj: string | Command[] | PathState) {
    if (typeof obj === 'string' || Array.isArray(obj)) {
      this.ps = new PathState(obj);
    } else {
      this.ps = obj;
    }
    if (!environment.production) {
      // Don't initialize variables lazily for dev builds (to avoid
      // ngrx-store-freeze crashes).
      this.getPathString();

      const allIds = this.getCommands().map(c => c.getId());
      const uniqueIds = new Set(allIds);
      const numCommands = allIds.length;
      if (uniqueIds.size !== numCommands) {
        const dumpInfo = this.getSubPaths().map((s, subIdx) => {
          return s.getCommands().map((c, cmdIdx) => {
            return { subIdx, cmdIdx, id: c.getId(), isDup: allIds.filter(id => id === c.getId()).length > 1 };
          });
        });
        console.warn('duplicate IDs found!', this, _.flatten(dumpInfo));
      }
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
  getSubPath(subIdx: number) {
    const numSubPaths = this.getSubPaths().length;
    if (subIdx < 0 || numSubPaths <= subIdx) {
      console.error(this);
      throw new Error(`Subpath index out of bounds: `
        + `subIdx=${subIdx} numSubPaths=${numSubPaths}`);
    }
    return this.getSubPaths()[subIdx];
  }

  // Implements the Path interface.
  getCommands() {
    return this.ps.commands;
  }

  // Implements the Path interface.
  getCommand(subIdx: number, cmdIdx: number) {
    const subPath = this.getSubPath(subIdx);
    const numCommands = subPath.getCommands().length;
    if (cmdIdx < 0 || numCommands <= cmdIdx) {
      console.error(this);
      throw new Error(`Command index out of bounds: `
        + `subIdx=${subIdx} cmdIdx=${cmdIdx}, numCommands=${numCommands}`);
    }
    return subPath.getCommands()[cmdIdx];
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
  project(point: Point, restrictToSubIdx?: number): ProjectionOntoPath | undefined {
    return this.ps.project(point, restrictToSubIdx);
  }

  // Implements the Path interface.
  hitTest(point: Point, opts: HitOptions): HitResult {
    return this.ps.hitTest(point, opts);
  }

  // Implements the Path interface.
  intersects(line: Line) {
    return this.ps.intersects(line);
  }

  // Implements the Path interface.
  getPoleOfInaccessibility(subIdx: number) {
    return this.ps.getPoleOfInaccessibility(subIdx);
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
