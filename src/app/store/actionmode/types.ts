/**
 * A selection represents an action that is the result of a mouse click.
 */
export interface Selection {
  readonly type: SelectionType;
  readonly source: ActionSource;
  readonly subIdx: number;
  readonly cmdIdx?: number;
}

/**
 * Describes the different types of selection events.
 */
export enum SelectionType {
  // The user selected an entire subpath.
  SubPath = 1,
  // The user selected an individual segment in a subpath.
  Segment,
  // The user selected an individual point in a subpath.
  Point,
}

/**
 * Different shape shifter modes.
 */
export enum ActionMode {
  Selection = 1,
  SplitCommands,
  SplitSubPaths,
  MorphSubPaths,
}

/**
 * Different action sources.
 */
export enum ActionSource {
  Start = 1,
  Preview,
  End,
}

/**
 * A hover represents a transient action that results from a mouse movement.
 */
export interface Hover {
  readonly type: HoverType;
  readonly source: ActionSource;
  readonly subIdx: number;
  readonly cmdIdx?: number;
}

/**
 * Describes the different types of hover events.
 */
export enum HoverType {
  SubPath = 1,
  Segment,
  Point,
  Split,
  Unsplit,
  Reverse,
  ShiftBack,
  ShiftForward,
  SetFirstPosition,
}
