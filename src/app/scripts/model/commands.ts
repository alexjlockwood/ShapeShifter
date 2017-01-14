import { Point, Projection } from '../common';

export interface ICommand { }

/** Defines the set of methods that are seen by the path inspector/canvas. */
export interface IPathCommand extends ICommand {

  /** The list of children sub path commands in this path. */
  commands: ReadonlyArray<ISubPathCommand>;

  /** Returns the length of the path. */
  pathLength: number;

  /** Draws the path on the provided canvas context. */
  execute(ctx: CanvasRenderingContext2D): void;

  /**
   * Interpolates this path between a start and end path using the specified fraction.
   * Does nothing if the paths are not morphable with each other.
   */
  interpolate(start: IPathCommand, end: IPathCommand, fraction: number): void;

  /** Returns true iff this path is morphable with the specified path command. */
  isMorphableWith(cmd: IPathCommand): boolean;

  /**
   * Calculates the point on this path that is closest to the specified point argument.
   * Also returns a 'split' function that can be used to split the path at the returned
   * projection point.
   */
  project(point: Point): { projection: Projection, split: () => void } | null;
}

/** Defines the set of methods that are seen by the sub path inspector/canvas. */
export interface ISubPathCommand extends ICommand {

  /** The list of children draw commands in this sub path. */
  commands: ReadonlyArray<IDrawCommand>;

  /** Returns true iff the sub path's start point is equal to its end point. */
  isClosed(): boolean;

  /** Reverses the order of the points in the sub path. */
  reverse(): ISubPathCommand;

  /** Shifts back the order of the points in the sub path. */
  shiftBack(): ISubPathCommand;

  /** Shifts forward the order of the points in the sub path. */
  shiftForward(): ISubPathCommand;
}

/** Defines the set of methods that are seen by the command inspector/canvas. */
export interface IDrawCommand extends ICommand {

  /** Returns the SVG character for this draw command. */
  svgChar: string;

  /** Returns the points for this draw command. */
  points: ReadonlyArray<Point>;

  /** Returns true iff the draw command is editable/deletable. */
  isModfiable: boolean;

  /**
   * Removes this draw command from its parent path data layer. Does nothing
   * if isModifiable returns false.
   */
  delete(): void;
}
