import { ToolMode } from 'app/model/paper';
import { HitTests, PaperLayer } from 'app/scripts/paper/item';
import { Cursor, CursorUtil, PivotType } from 'app/scripts/paper/util';
import { PaperService } from 'app/services';
import * as paper from 'paper';

import { Gesture } from './Gesture';

/**
 * A gesture that performs hover operations on items.
 *
 * Preconditions:
 * - The user is in selection mode.
 */
export class HoverItemsGesture extends Gesture {
  private readonly pl = paper.project.activeLayer as PaperLayer;

  constructor(private readonly ps: PaperService) {
    super();
  }

  // @Override
  onMouseMove(event: paper.ToolEvent) {
    CursorUtil.clear();

    const selectedLayers = this.ps.getSelectedLayers();
    if (selectedLayers.size > 0) {
      const selectionBoundSegmentsHitResult = HitTests.selectionModeSegments(event.point);
      if (selectionBoundSegmentsHitResult) {
        const toolMode = this.ps.getToolMode();
        const cursorMap = toolMode === ToolMode.Rotate ? ROTATE_CURSOR_MAP : RESIZE_CURSOR_MAP;
        CursorUtil.set(cursorMap.get(selectionBoundSegmentsHitResult.item.pivotType));
        this.ps.setHoveredLayer(undefined);
        return;
      }
    }
    const hitResult = HitTests.selectionMode(event.point, {
      // TODO: support hovering over groups
      class: paper.Path,
      match: ({ item }) => !selectedLayers.has(item.data.id),
    });
    this.ps.setHoveredLayer(hitResult ? hitResult.item.data.id : undefined);
  }
}

const RESIZE_CURSOR_MAP: ReadonlyMap<PivotType, Cursor> = new Map([
  ['bottomLeft', Cursor.Resize45],
  ['leftCenter', Cursor.Resize90],
  ['topLeft', Cursor.Resize135],
  ['topCenter', Cursor.Resize0],
  ['topRight', Cursor.Resize45],
  ['rightCenter', Cursor.Resize90],
  ['bottomRight', Cursor.Resize135],
  ['bottomCenter', Cursor.Resize0],
] as [PivotType, Cursor][]);

const ROTATE_CURSOR_MAP: ReadonlyMap<PivotType, Cursor> = new Map([
  ['bottomLeft', Cursor.Rotate225],
  ['leftCenter', Cursor.Rotate270],
  ['topLeft', Cursor.Rotate315],
  ['topCenter', Cursor.Rotate0],
  ['topRight', Cursor.Rotate45],
  ['rightCenter', Cursor.Rotate90],
  ['bottomRight', Cursor.Rotate135],
  ['bottomCenter', Cursor.Rotate180],
] as [PivotType, Cursor][]);
