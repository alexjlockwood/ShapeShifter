import { Point } from './mathutil';

export interface ICommand {
  /** A unique identifier for this command. Used by ngFor* loops for efficient DOM updates. */
  id: string;
}

/** Defines the set of methods that are seen by the path inspector. */
export interface IPathCommand extends ICommand {

  /** The list of children sub path commands in this path. */
  commands: ISubPathCommand[];
}

/** Defines the set of methods that are seen by the sub path inspector. */
export interface ISubPathCommand extends ICommand {

  /** The list of children draw commands in this sub path. */
  commands: IDrawCommand[];

  /** Returns true iff the subpath's start point is equal to its end point. */
  isClosed(): boolean;

  /** Reverses the order of the points in the sub path. */
  reverse(): void;

  /** Shifts back the order of the points in the sub path. */
  shiftBack(): void;

  /** Shifts forward the order of the points in the sub path. */
  shiftForward(): void;
}

/** Defines the set of methods that are seen by the command inspector. */
export interface IDrawCommand extends ICommand {

  /** Returns the SVG character for this draw command. */
  svgChar: string;

  /** Returns the points for this draw command. */
  points: Point[];

  /** Returns true iff the draw command is editable/deletable. */
  isModfiable: boolean;

  /**
   * Removes this draw command from its parent path data layer. Does nothing
   * if isModifiable returns false.
   */
  delete(): void;
}
