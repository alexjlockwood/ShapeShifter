import { Point, Matrix } from '../common';
import { SvgChar } from '.';

/**
 * Defines the set of SVG command methods that are seen by the inspector/canvas.
 */
export interface Command {

  /**
   * Returns the SVG character for this command.
   */
  svgChar: SvgChar;

  /**
   * A human-readable representation of this command.
   */
  commandString: string;

  /**
   * Returns the raw number arguments for this command.
   */
  args: ReadonlyArray<number>;

  /**
   * Returns the points for this command.
   */
  points: ReadonlyArray<Point>;

  /**
   * Returns the command's starting point.
   */
  start: Point;

  /**
   * Returns the command's ending point.
   */
  end: Point;

  /**
   * Returns true iff the command was created as a result of being split.
   * Only split commands are able to be editted and deleted via the inspector/canvas.
   */
  isSplit: boolean;

  /**
   * Returns true iff this command can be converted into a new command
   * that is morphable with the specified SVG command type.
   */
  canConvertTo(ch: SvgChar): boolean;

  /**
   * Returns a transformed SVG command.
   */
  transform(matrices: Matrix[]): Command;
}

/**
 * Uniquely identifies a command's location in an SVG.
 */
export interface Id {
  readonly pathId: string;
  readonly subIdx: number;
  readonly cmdIdx: number;
}
