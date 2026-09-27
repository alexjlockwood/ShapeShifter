import type {
  PointCommand,
  PointMenuState,
} from 'app/modules/editor/components/canvas/CanvasEditorApi';
import { Path } from 'app/modules/editor/model/paths';
import * as PathEdit from 'app/modules/editor/model/paths/PathEdit';

// What the point commands of the context menu and the inspector can do to the selected points of
// the path being edited, as plain functions of the path and the selection.

/** Returns what the point commands can do to the selected points, or undefined if there are none. */
export function getPointMenuState(
  path: Path,
  selectedAnchorIds: ReadonlySet<string>,
): PointMenuState | undefined {
  const selected = PathEdit.getAnchors(path).filter(a => selectedAnchorIds.has(a.id));
  if (!selected.length) {
    return undefined;
  }
  const types = new Set(selected.map(a => a.type));
  const subIdxs = new Set(selected.map(a => a.subIdx));
  const [subIdx] = subIdxs;
  const isSubPathClosed = subIdxs.size === 1 ? PathEdit.isSubPathClosed(path, subIdx) : undefined;
  return {
    selectedCount: selected.length,
    pointType: types.size === 1 ? selected[0].type : undefined,
    isSubPathClosed,
    toggleClosedReason: getToggleClosedReason(path, subIdx, isSubPathClosed),
    setFirstReason:
      selected.length === 1
        ? PathEdit.getSetFirstAnchorRefusal(path, selected[0].id)
        : 'Select just one point',
  };
}

function getToggleClosedReason(path: Path, subIdx: number, isClosed: boolean | undefined) {
  if (isClosed === undefined) {
    return 'The points are in different subpaths';
  }
  return !isClosed && PathEdit.getAnchorCount(path, subIdx) < 2
    ? 'A subpath needs two points to close'
    : undefined;
}

/**
 * Returns the path with the command applied to the selected points, and the points to select
 * afterward, or undefined if it can't be applied. Deleting is left to the editor, which deletes
 * the layer instead when nothing would be left.
 */
export function applyPointCommand(
  path: Path,
  selectedAnchorIds: ReadonlySet<string>,
  command: Exclude<PointCommand, { type: 'delete' }>,
): { readonly path: Path; readonly selectedAnchorIds?: ReadonlySet<string> } | undefined {
  const state = getPointMenuState(path, selectedAnchorIds);
  if (!state) {
    return undefined;
  }
  const selected = PathEdit.getAnchors(path).filter(a => selectedAnchorIds.has(a.id));
  switch (command.type) {
    case 'setPointType':
      return { path: PathEdit.setPointType(path, selectedAnchorIds, command.pointType) };
    case 'toggleClosed': {
      if (state.toggleClosedReason !== undefined) {
        return undefined;
      }
      const { subIdx } = selected[0];
      return {
        path: state.isSubPathClosed
          ? PathEdit.openSubPath(path, subIdx)
          : PathEdit.closeSubPath(path, subIdx),
      };
    }
    case 'setFirstPoint':
      return state.setFirstReason === undefined
        ? { path: PathEdit.setFirstAnchor(path, selected[0].id) }
        : undefined;
  }
}
