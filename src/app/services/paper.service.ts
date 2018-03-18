import { Injectable, NgZone } from '@angular/core';
import { VectorLayer } from 'app/model/layers';
import { CanvasCursor, ToolMode } from 'app/model/paper';
import { Point } from 'app/scripts/common';
import { State, Store } from 'app/store';
import { SetHoveredLayer } from 'app/store/layers/actions';
import {
  getHiddenLayerIds,
  getHoveredLayerId,
  getSelectedLayerIds,
} from 'app/store/layers/selectors';
import { Action } from 'app/store/ngrx';
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
    // TODO: figure out if this is the most efficient use of NgZone...
    // TODO: can we get away with only executing in NgZone for certain dispatch store ops?
    private readonly ngZone: NgZone,
  ) {}

  /** Sets the current vector layer. */
  setVectorLayer(vl: VectorLayer) {
    // TODO: use this.dispatchStore()
    this.ngZone.run(() => this.layerTimelineService.setVectorLayer(vl));
  }

  /** Gets the current vector layer. */
  getVectorLayer() {
    return this.layerTimelineService.getVectorLayer();
  }

  /** Sets the set of selected layer IDs. */
  setSelectedLayerIds(layerIds: Set<string>) {
    if (!_.isEqual(this.queryStore(getSelectedLayerIds), layerIds)) {
      // TODO: use this.dispatchStore()
      this.ngZone.run(() => this.layerTimelineService.setSelectedLayers(layerIds));
    }
  }

  /** Gets the set of selected layer IDs. */
  getSelectedLayerIds() {
    return this.queryStore(getSelectedLayerIds);
  }

  /** Sets or clears the currently hovered layer ID. */
  setHoveredLayerId(layerId: string | undefined) {
    if (this.queryStore(getHoveredLayerId) !== layerId) {
      // TODO: use this.dispatchStore()
      this.ngZone.run(() => this.store.dispatch(new SetHoveredLayer(layerId)));
    }
  }

  /** Gets the current hover layer ID. */
  getHoveredLayerId() {
    return this.queryStore(getHoveredLayerId);
  }

  /** Gets the current set of hidden layer IDs. */
  getHiddenLayerIds() {
    return this.queryStore(getHiddenLayerIds);
  }

  /** Sets the current selection box. */
  setSelectionBox(box: { from: Point; to: Point } | undefined) {
    this.dispatchStore(new SetSelectionBox(box), getSelectionBox);
  }

  /** Gets the current selection box. */
  getSelectionBox() {
    return this.queryStore(getSelectionBox);
  }

  /** Sets the current create path info. */
  setCreatePathInfo(info: CreatePathInfo | undefined) {
    this.dispatchStore(new SetCreatePathInfo(info), getCreatePathInfo);
  }

  /** Gets the current create path info. */
  getCreatePathInfo() {
    return this.queryStore(getCreatePathInfo);
  }

  /** Sets the current split curve info. */
  setSplitCurveInfo(info: SplitCurveInfo | undefined) {
    this.dispatchStore(new SetSplitCurveInfo(info), getSplitCurveInfo);
  }

  /** Sets the current tool mode. */
  setToolMode(toolMode: ToolMode) {
    this.dispatchStore(new SetToolMode(toolMode), getToolMode);
  }

  /** Gets the current tool mode. */
  getToolMode() {
    return this.queryStore(getToolMode);
  }

  /** Sets the current focused path info. */
  setFocusedPathInfo(info: FocusedPathInfo | undefined) {
    this.dispatchStore(new SetFocusedPathInfo(info), getFocusedPathInfo);
  }

  /** Gets the current focused path info. */
  getFocusedPathInfo() {
    return this.queryStore(getFocusedPathInfo);
  }

  /** Sets the current canvas cursor. */
  setCanvasCursor(canvasCursor: CanvasCursor | undefined) {
    this.dispatchStore(new SetCanvasCursor(canvasCursor), getCanvasCursor);
  }

  /** Sets the current snap guide info. */
  setSnapGuideInfo(info: SnapGuideInfo | undefined) {
    this.dispatchStore(new SetSnapGuideInfo(info), getSnapGuideInfo);
  }

  /** Sets the current zoom/pan info. */
  setZoomPanInfo(info: ZoomPanInfo) {
    this.dispatchStore(new SetZoomPanInfo(info), getZoomPanInfo);
  }

  /** Sets the current tooltip info. */
  setTooltipInfo(info: TooltipInfo | undefined) {
    this.dispatchStore(new SetTooltipInfo(info), getTooltipInfo);
  }

  private dispatchStore<T>(
    action: Action<T>,
    selector: OutputSelector<Object, T, (res: Object) => T>,
  ) {
    if (!_.isEqual(this.queryStore(selector), action.payload)) {
      if (NgZone.isInAngularZone()) {
        this.store.dispatch(action);
      } else {
        // PaperService methods are usually executed outside of the Angular zone
        // (since they originate from event handlers registered by paper.js). In
        // order to ensure change detection works properly, we need to force
        // state changes to be executed inside the Angular zone.
        this.ngZone.run(() => this.store.dispatch(action));
      }
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
