import { ActionMode, ActionSource } from 'app/modules/editor/model/actionmode';
import type { MorphableLayer } from 'app/modules/editor/model/layers';
import type { Path } from 'app/modules/editor/model/paths';
import type { PathAnimationBlock } from 'app/modules/editor/model/timeline';
import { ActionModeUtil } from 'app/modules/editor/scripts/actionmode';

/** What the status strip under the app bar says in action mode. */
export interface ActionModeStatus {
  /** Whether the block's paths morph into each other. */
  readonly morphs: boolean;
  /** "Morphs", or "Doesn't morph" and why. */
  readonly summary: string;
  /** What to do next, e.g. how to use the current mode, or an empty string. */
  readonly hint: string;
  /** Whether to offer auto fix, which can make paths that don't morph morph. */
  readonly canAutoFix: boolean;
}

export interface ActionModeStatusOptions {
  readonly mode: ActionMode;
  /** The block being edited. It can be deselected (by undo) before action mode closes. */
  readonly block: PathAnimationBlock | undefined;
  /** The block's layer, which says whether a split draws a line or clicks an edge. */
  readonly layer: MorphableLayer | undefined;
  /** In pair subpaths mode, the side of the subpath picked so far. */
  readonly unpairedSubPathSource: ActionSource | undefined;
  /** Whether any subpaths, segments, or points are selected. */
  readonly hasSelections: boolean;
}

/**
 * Says whether the morph works, and if it doesn't, why not, along with the next step. Returns
 * undefined outside of action mode, or when there's no block.
 */
export function getActionModeStatus({
  mode,
  block,
  layer,
  unpairedSubPathSource,
  hasSelections,
}: ActionModeStatusOptions): ActionModeStatus | undefined {
  if (mode === ActionMode.None || !block) {
    return undefined;
  }
  const { morphs, summary, canAutoFix, fixHint } = checkMorph(block);
  return { morphs, summary, canAutoFix, hint: getHint() };

  function getHint() {
    switch (mode) {
      case ActionMode.SplitCommands:
        return 'Click along the edge of a subpath to add a point';
      case ActionMode.SplitSubPaths:
        if (layer?.isFilled()) {
          return 'Draw a line across a subpath to split it into 2';
        }
        if (layer?.isStroked()) {
          return 'Click along the edge of a subpath to split it into 2';
        }
        return '';
      case ActionMode.PairSubPaths:
        if (unpairedSubPathSource === ActionSource.From) {
          return 'Now select the subpath at the end to pair it with';
        }
        if (unpairedSubPathSource === ActionSource.To) {
          return 'Now select the subpath at the start to pair it with';
        }
        return 'Select a subpath at the start or the end to pair it';
      default:
        if (fixHint) {
          return fixHint;
        }
        return !morphs || hasSelections ? '' : 'Click a subpath to edit it';
    }
  }
}

function checkMorph(block: PathAnimationBlock) {
  const { fromValue, toValue } = block;
  const isFromEmpty = isEmpty(fromValue);
  const isToEmpty = isEmpty(toValue);
  if (isFromEmpty || isToEmpty) {
    const which =
      isFromEmpty && isToEmpty ? 'both paths are' : `the ${isFromEmpty ? 'start' : 'end'} path is`;
    return {
      morphs: false,
      summary: `Doesn't morph: ${which} empty`,
      canAutoFix: false,
      fixHint: 'Leave the morph editor to set the path in the property inspector',
    };
  }
  const { areCompatible, errorPath, errorSubIdx, numPointsMissing } =
    ActionModeUtil.checkPathsCompatible(block);
  if (areCompatible) {
    return { morphs: true, summary: 'Morphs', canAutoFix: false, fixHint: '' };
  }
  const numFromSubPaths = fromValue?.getSubPaths().length ?? 0;
  const numToSubPaths = toValue?.getSubPaths().length ?? 0;
  if (numFromSubPaths !== numToSubPaths) {
    return {
      morphs: false,
      summary:
        `Doesn't morph: the start has ${pluralize(numFromSubPaths, 'subpath')} ` +
        `and the end has ${numToSubPaths}`,
      canAutoFix: true,
      fixHint: '',
    };
  }
  if (errorSubIdx === undefined || !numPointsMissing) {
    return {
      morphs: false,
      summary: "Doesn't morph: the paths' commands don't match",
      canAutoFix: true,
      fixHint: '',
    };
  }
  const numPoints = (path: Path | undefined) =>
    path?.getSubPath(errorSubIdx).getCommands().length ?? 0;
  const side = errorPath === ActionSource.From ? 'start' : 'end';
  return {
    morphs: false,
    // Subpaths are numbered from 1 for people, and from 0 in the code.
    summary:
      `Doesn't morph: subpath ${errorSubIdx + 1} has ` +
      `${pluralize(numPoints(fromValue), 'point')} at the start and ${numPoints(toValue)} at the end`,
    canAutoFix: true,
    fixHint: `Add ${pluralize(numPointsMissing, 'point')} to the highlighted subpath at the ${side}`,
  };
}

function isEmpty(path: Path | undefined) {
  return !path?.getPathString();
}

function pluralize(count: number, noun: string) {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}
