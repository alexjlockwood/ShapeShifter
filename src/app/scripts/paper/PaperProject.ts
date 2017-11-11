import { PaperLayer } from 'app/scripts/paper/item';
import { MasterTool } from 'app/scripts/paper/tool';
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
  private readonly masterTool: MasterTool;
  private readonly subscriptions: Subscription[] = [];

  constructor(canvas: HTMLCanvasElement, ps: PaperService) {
    super(canvas);
    const pl = new PaperLayer();
    paper.project.addLayer(pl);
    this.paperLayer = pl;
    this.masterTool = new MasterTool(ps);
    this.subscriptions.push(
      ps.store.select(getToolMode).subscribe(toolMode => this.masterTool.setToolMode(toolMode)),
      ps.store.select(getVectorLayer).subscribe(vl => pl.setVectorLayer(vl)),
      ps.store.select(getSelectedLayerIds).subscribe(ids => pl.setSelectedLayers(ids)),
      ps.store.select(getHoveredLayerId).subscribe(id => pl.setHoveredLayer(id)),
      ps.store.select(getCreatePathInfo).subscribe(info => pl.setCreatePathInfo(info)),
      ps.store.select(getSplitCurveInfo).subscribe(info => pl.setSplitCurveInfo(info)),
      ps.store.select(getFocusedPathInfo).subscribe(info => pl.setFocusedPathInfo(info)),
      ps.store.select(getSnapGuideInfo).subscribe(info => pl.setSnapGuideInfo(info)),
      ps.store.select(getHiddenLayerIds).subscribe(ids => pl.setHiddenLayers(ids)),
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
   * Sets the project's dimensions with the new VectorLayer viewport and canvas element size.
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

  remove() {
    super.remove();
    while (this.subscriptions.length) {
      this.subscriptions.pop().unsubscribe();
    }
  }
}
