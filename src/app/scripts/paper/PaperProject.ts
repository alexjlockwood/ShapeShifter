import { PaperLayer } from 'app/scripts/paper/item';
import { MasterToolDelegate } from 'app/scripts/paper/tool';
import { PaperService } from 'app/services';
import {
  getHiddenLayerIds,
  getHoveredLayerId,
  getSelectedLayerIds,
  getVectorLayer,
} from 'app/store/layers/selectors';
import {
  getCreatePathInfo,
  getFocusedPathInfo,
  getSelectionBox,
  getSnapGuideInfo,
  getSplitCurveInfo,
  getToolMode,
  getTooltipInfo,
  getZoomPanInfo,
} from 'app/store/paper/selectors';
import * as paper from 'paper';
import { Subscription } from 'rxjs/Subscription';

export class PaperProject extends paper.Project {
  private readonly paperLayer: PaperLayer;
  private readonly masterToolDelegate: MasterToolDelegate;
  private readonly subscriptions: Subscription[] = [];

  constructor(canvas: HTMLCanvasElement, ps: PaperService) {
    super(canvas);
    const pl = new PaperLayer(ps);
    paper.project.addLayer(pl);
    this.paperLayer = pl;
    this.masterToolDelegate = new MasterToolDelegate(ps);
    this.subscriptions.push(
      ps.store.select(getToolMode).subscribe(() => this.masterToolDelegate.onToolModeChanged()),
      ps.store.select(getVectorLayer).subscribe(() => pl.onVectorLayerChanged()),
      ps.store.select(getSelectedLayerIds).subscribe(() => pl.onSelectedLayerIdsChanged()),
      ps.store.select(getHoveredLayerId).subscribe(() => pl.onHoveredLayerIdChanged()),
      ps.store.select(getHiddenLayerIds).subscribe(() => pl.onHiddenLayerIdsChanged()),
      ps.store.select(getCreatePathInfo).subscribe(info => pl.setCreatePathInfo(info)),
      ps.store.select(getSplitCurveInfo).subscribe(info => pl.setSplitCurveInfo(info)),
      ps.store.select(getFocusedPathInfo).subscribe(info => pl.onFocusedPathInfoChanged()),
      ps.store.select(getSnapGuideInfo).subscribe(info => pl.setSnapGuideInfo(info)),
      ps.store.select(getTooltipInfo).subscribe(info => pl.setTooltipInfo(info)),
      ps.store.select(getSelectionBox).subscribe(box => {
        if (box) {
          const from = new paper.Point(box.from);
          const to = new paper.Point(box.to);
          pl.setSelectionBox({ from, to });
        } else {
          pl.setSelectionBox(undefined);
        }
      }),
      ps.store.select(getZoomPanInfo).subscribe(({ zoom, translation: { tx, ty } }) => {
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
