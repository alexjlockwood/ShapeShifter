import { Command } from '.';

/**
 * Defines a set of commands that begins with a single move to command.
 */
export interface SubPath {

  /**
   * Returns a unique ID for this subpath.
   */
  getId(): string;

  /**
   * The list of commands in this subpath.
   */
  getCommands(): ReadonlyArray<Command>;

  /**
   * Returns true iff the sub path's start point is equal to its end point.
   */
  isClosed(): boolean;
}
