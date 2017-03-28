import { Command } from '.';
import { SubPathBuilder } from './SubPathImpl';

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

  /**
   * Returns true iff this sub path was created to collapse to a single point.
   */
  isCollapsing(): boolean;

  /**
   * Returns true iff this sub path was created as a result of a split.
   */
  isSplit(): boolean;

  /**
   * Returns true iff this sub path has been reversed.
   */
  isReversed(): boolean;

  /**
   * Returns the shift offset of this sub path.
   */
  getShiftOffset(): number;

  /**
   * Returns a builder to construct a mutated SubPath.
   */
  mutate(): SubPathBuilder;
}
