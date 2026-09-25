/**
 * A selection represents an action that is the result of a mouse click.
 */
export type Selection = SubPathSelection | CommandSelection;

interface SubPathSelection {
  readonly type: SelectionType.SubPath;
  readonly source: ActionSource;
  readonly subIdx: number;
  readonly cmdIdx?: undefined;
}

/** Selects a segment or a point. */
interface CommandSelection {
  readonly type: SelectionType.Segment | SelectionType.Point;
  readonly source: ActionSource;
  readonly subIdx: number;
  readonly cmdIdx: number;
}

/** Returns the selections of the specified type. */
export function getSelectionsOfType<T extends SelectionType>(
  selections: ReadonlyArray<Selection>,
  type: T,
) {
  return selections.filter((s): s is Selection & { readonly type: T } => s.type === type);
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
  None = 1,
  Selection,
  SplitCommands,
  PairSubPaths,
  SplitSubPaths,
}

/**
 * Different action sources.
 */
export enum ActionSource {
  From = 1,
  Animated,
  To,
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
