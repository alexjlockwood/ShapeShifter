import { CursorType } from 'app/model/paper';
import { Gesture } from 'app/scripts/paper/gesture';
import { HitTests } from 'app/scripts/paper/item';
import { PivotType } from 'app/scripts/paper/util';
import { PaperService } from 'app/services';
import * as paper from 'paper';

// prettier-ignore
const RESIZE_CURSOR_MAP: ReadonlyMap<PivotType, CursorType> = new Map([
  ['bottomLeft', CursorType.Resize45], ['leftCenter', CursorType.Resize90],
  ['topLeft', CursorType.Resize135], ['topCenter', CursorType.Resize0],
  ['topRight', CursorType.Resize45], ['rightCenter', CursorType.Resize90],
  ['bottomRight', CursorType.Resize135], ['bottomCenter', CursorType.Resize0],
] as [PivotType, CursorType][]);

// prettier-ignore
const ROTATE_CURSOR_MAP: ReadonlyMap<PivotType, CursorType> = new Map([
  ['bottomLeft', CursorType.Rotate225], ['leftCenter', CursorType.Rotate270],
  ['topLeft', CursorType.Rotate315], ['topCenter', CursorType.Rotate0],
  ['topRight', CursorType.Rotate45], ['rightCenter', CursorType.Rotate90],
  ['bottomRight', CursorType.Rotate135], ['bottomCenter', CursorType.Rotate180],
] as [PivotType, CursorType][]);

// prettier-ignore
const TRANSFORM_CURSOR_MAP: ReadonlyMap<PivotType, CursorType> = new Map([
  ['bottomLeft', CursorType.Resize45], ['leftCenter', CursorType.Resize0],
  ['topLeft', CursorType.Resize135], ['topCenter', CursorType.Resize90],
  ['topRight', CursorType.Resize45], ['rightCenter', CursorType.Resize0],
  ['bottomRight', CursorType.Resize135], ['bottomCenter', CursorType.Resize90],
] as [PivotType, CursorType][]);

/**
 * A gesture that performs hover operations on items.
 *
 * Preconditions:
 * - The user is in default mode.
 */
export class HoverItemsGesture extends Gesture {
  constructor(private readonly ps: PaperService) {
    super();
  }

  // @Override
  onMouseMove(event: paper.ToolEvent) {
    this.ps.setCursorType(CursorType.Default);

    const selectedLayers = this.ps.getSelectedLayerIds();
    if (selectedLayers.size) {
      const selectionBoundSegmentsHitResult = HitTests.selectionModeSegments(event.point);
      if (selectionBoundSegmentsHitResult) {
        const rii = this.ps.getRotateItemsInfo();
        const tpi = this.ps.getTransformPathsInfo();
        const cursorMap = rii ? ROTATE_CURSOR_MAP : tpi ? TRANSFORM_CURSOR_MAP : RESIZE_CURSOR_MAP;
        this.ps.setCursorType(cursorMap.get(selectionBoundSegmentsHitResult.item.pivotType));
        this.ps.setHoveredLayerId(undefined);
        return;
      }
    }

    const hitResult = HitTests.selectionMode(event.point, this.ps);
    if (hitResult && !selectedLayers.has(hitResult.hitItem.data.id)) {
      this.ps.setHoveredLayerId(hitResult.hitItem.data.id);
    } else {
      this.ps.setHoveredLayerId(undefined);
    }
  }

  // @Override
  onKeyDown(event: paper.KeyEvent) {
    // TODO: also do this in any other hover/pen/pencil related gestures?
    if (event.key === 'escape') {
      this.ps.setCursorType(CursorType.Default);
      this.ps.setSnapGuideInfo(undefined);
      this.ps.setRotateItemsInfo(undefined);
      this.ps.setTransformPathsInfo(undefined);
    }
  }
}
