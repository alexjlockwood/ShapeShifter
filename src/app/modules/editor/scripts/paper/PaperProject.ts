import { PaperLayer } from 'app/modules/editor/scripts/paper/item';
import { MasterToolPicker } from 'app/modules/editor/scripts/paper/tool';
import { PaperService } from 'app/modules/editor/services';
import { State, Store } from 'app/modules/editor/store';
import { getHiddenLayerIds, getSelectedLayerIds } from 'app/modules/editor/store/layers/selectors';
import {
  getCreatePathInfo,
  getEditPathInfo,
  getHoveredLayerId,
  getRotateItemsInfo,
  getSelectionBox,
  getSnapGuideInfo,
  getSplitCurveInfo,
  getToolMode,
  getTooltipInfo,
  getZoomPanInfo,
} from 'app/modules/editor/store/paper/selectors';
import { getAnimatedVectorLayer } from 'app/modules/editor/store/playback/selectors';
import * as paper from 'paper';
import { Subscription } from 'rxjs';

export class PaperProject extends paper.Project {
  private readonly paperLayer: PaperLayer;
  private readonly masterToolPicker: MasterToolPicker;
  private readonly subscriptions: Subscription[] = [];

  constructor(canvas: HTMLCanvasElement, ps: PaperService, store: Store<State>) {
    super(canvas);
    const pl = new PaperLayer(ps);
    paper.project.addLayer(pl);
    this.paperLayer = pl;
    this.masterToolPicker = new MasterToolPicker(ps);
    this.subscriptions.push(
      store.select(getToolMode).subscribe(() => this.masterToolPicker.onToolModeChanged()),
      // TODO: dont allow the user to modify the vector layer when current time > 0
      store.select(getAnimatedVectorLayer).subscribe(() => pl.onVectorLayerChanged()),
      store.select(getSelectedLayerIds).subscribe(() => pl.onSelectedLayerIdsChanged()),
      store.select(getHoveredLayerId).subscribe(() => pl.onHoveredLayerIdChanged()),
      store.select(getHiddenLayerIds).subscribe(() => pl.onHiddenLayerIdsChanged()),
      store.select(getCreatePathInfo).subscribe(info => pl.setCreatePathInfo(info)),
      store.select(getSplitCurveInfo).subscribe(info => pl.setSplitCurveInfo(info)),
      store.select(getEditPathInfo).subscribe(info => pl.onEditPathInfoChanged()),
      store.select(getRotateItemsInfo).subscribe(info => pl.onRotateItemsInfoChanged()),
      store.select(getSnapGuideInfo).subscribe(info => pl.setSnapGuideInfo(info)),
      store.select(getTooltipInfo).subscribe(info => pl.setTooltipInfo(info)),
      store.select(getSelectionBox).subscribe(box => {
        if (box) {
          const from = new paper.Point(box.from);
          const to = new paper.Point(box.to);
          pl.setSelectionBox({ from, to });
        } else {
          pl.setSelectionBox(undefined);
        }
      }),
      store.select(getZoomPanInfo).subscribe(({ zoom, translation: { tx, ty } }) => {
        this.view.matrix = new paper.Matrix(zoom, 0, 0, zoom, tx, ty);
      }),
    );
  }

  /**
   * Sets the project's dimensions with the new VectorLayer viewport and canvas element size (in CSS pixels).
   */
  setDimensions(
    viewportWidth: number,
    viewportHeight: number,
    viewWidth: number,
    viewHeight: number,
  ) {
    // The view size represents the actual size of the canvas in CSS pixels.
    // The viewport size represents the user-visible dimensions (i.e. the default 24x24).
    this.view.viewSize = new paper.Size(viewWidth, viewHeight);
    this.paperLayer.setDimensions(viewportWidth, viewportHeight, viewWidth, viewHeight);
  }

  // @Override
  remove() {
    super.remove();
    while (this.subscriptions.length) {
      this.subscriptions.pop().unsubscribe();
    }
  }
}
