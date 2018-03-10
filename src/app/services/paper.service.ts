import { Injectable } from '@angular/core';
import { VectorLayer } from 'app/model/layers';
import { CanvasCursor, ToolMode } from 'app/model/paper';
import { Point } from 'app/scripts/common';
import { State, Store } from 'app/store';
import { SetHoveredLayer } from 'app/store/layers/actions';
import { getHoveredLayerId, getSelectedLayerIds } from 'app/store/layers/selectors';
import {
  CreatePathInfo,
  FocusedPathInfo,
  SetCanvasCursor,
  SetCreatePathInfo,
  SetFocusedPathInfo,
  SetSelectionBox,
  SetSnapGuideInfo,
  SetSplitCurveInfo,
  SetToolMode,
  SetTooltipInfo,
  SetZoomPanInfo,
  SnapGuideInfo,
  SplitCurveInfo,
  TooltipInfo,
  ZoomPanInfo,
} from 'app/store/paper/actions';
import {
  getCanvasCursor,
  getCreatePathInfo,
  getFocusedPathInfo,
  getSelectionBox,
  getSnapGuideInfo,
  getSplitCurveInfo,
  getToolMode,
  getTooltipInfo,
  getZoomPanInfo,
} from 'app/store/paper/selectors';
import * as _ from 'lodash';
import { OutputSelector } from 'reselect';
import { first } from 'rxjs/operators';

import { LayerTimelineService } from './layertimeline.service';

/** A simple service that provides an interface for making paper.js changes to the store. */
@Injectable()
export class PaperService {
  constructor(
    private readonly layerTimelineService: LayerTimelineService,
    readonly store: Store<State>,
  ) {}

  /** Sets the current vector layer. */
  setVectorLayer(vl: VectorLayer) {
    return this.layerTimelineService.setVectorLayer(vl);
  }

  /** Gets the current vector layer. */
  getVectorLayer() {
    return this.layerTimelineService.getVectorLayer();
  }

  /** Sets the set of selected layer IDs. */
  setSelectedLayers(layerIds: Set<string>) {
    if (!_.isEqual(this.queryStore(getSelectedLayerIds), layerIds)) {
      this.layerTimelineService.setSelectedLayers(layerIds);
    }
  }

  /** Gets the set of selected layer IDs. */
  getSelectedLayers() {
    return this.queryStore(getSelectedLayerIds);
  }

  /** Sets or clears the currently hovered layer ID. */
  setHoveredLayer(layerId: string | undefined) {
    if (this.queryStore(getHoveredLayerId) !== layerId) {
      this.store.dispatch(new SetHoveredLayer(layerId));
    }
  }

  /** Sets the current selection box. */
  setSelectionBox(box: { from: Point; to: Point } | undefined) {
    if (!_.isEqual(this.getSelectionBox(), box)) {
      this.store.dispatch(new SetSelectionBox(box));
    }
  }

  /** Gets the current selection box. */
  getSelectionBox() {
    return this.queryStore(getSelectionBox);
  }

  /** Sets the current create path info. */
  setCreatePathInfo(info: CreatePathInfo | undefined) {
    if (!_.isEqual(this.getCreatePathInfo(), info)) {
      this.store.dispatch(new SetCreatePathInfo(info));
    }
  }

  /** Gets the current create path info. */
  getCreatePathInfo() {
    return this.queryStore(getCreatePathInfo);
  }

  /** Sets the current split curve info. */
  setSplitCurveInfo(info: SplitCurveInfo | undefined) {
    if (!_.isEqual(this.queryStore(getSplitCurveInfo), info)) {
      this.store.dispatch(new SetSplitCurveInfo(info));
    }
  }

  /** Sets the current tool mode. */
  setToolMode(toolMode: ToolMode) {
    if (this.getToolMode() !== toolMode) {
      this.store.dispatch(new SetToolMode(toolMode));
    }
  }

  /** Gets the current tool mode. */
  getToolMode() {
    return this.queryStore(getToolMode);
  }

  /** Sets the current focused path info. */
  setFocusedPathInfo(info: FocusedPathInfo | undefined) {
    if (!_.isEqual(this.getFocusedPathInfo(), info)) {
      this.store.dispatch(new SetFocusedPathInfo(info));
    }
  }

  /** Gets the current focused path info. */
  getFocusedPathInfo() {
    return this.queryStore(getFocusedPathInfo);
  }

  /** Sets the current canvas cursor. */
  setCanvasCursor(canvasCursor: CanvasCursor | undefined) {
    if (this.queryStore(getCanvasCursor) !== canvasCursor) {
      this.store.dispatch(new SetCanvasCursor(canvasCursor));
    }
  }

  /** Sets the current snap guide info. */
  setSnapGuideInfo(info: SnapGuideInfo | undefined) {
    if (!_.isEqual(this.queryStore(getSnapGuideInfo), info)) {
      this.store.dispatch(new SetSnapGuideInfo(info));
    }
  }

  /** Sets the current zoom/pan info. */
  setZoomPanInfo(info: ZoomPanInfo) {
    if (!_.isEqual(this.queryStore(getZoomPanInfo), info)) {
      this.store.dispatch(new SetZoomPanInfo(info));
    }
  }

  /** Sets the current tooltip info. */
  setTooltipInfo(info: TooltipInfo) {
    if (!_.isEqual(this.queryStore(getTooltipInfo), info)) {
      this.store.dispatch(new SetTooltipInfo(info));
    }
  }

  private queryStore<T>(selector: OutputSelector<Object, T, (res: Object) => T>) {
    let obj: T;
    this.store
      .select(selector)
      .pipe(first())
      .subscribe(o => (obj = o));
    return obj;
  }
}
