import { Command } from '.';

/**
 * Defines the set of methods that are seen by the UI.
 */
export interface SubPath {

  /**
   * The list of commands in this sub path.
   */
  getCommands(): ReadonlyArray<Command>;

  /**
   * Returns true iff the sub path's start point is equal to its end point.
   */
  isClosed(): boolean;
}
