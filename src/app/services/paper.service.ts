import { Injectable, NgZone } from '@angular/core';
import { VectorLayer } from 'app/model/layers';
import { CursorType, ToolMode } from 'app/model/paper';
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
  EditPathInfo,
  RotateItemsInfo,
  SetCreatePathInfo,
  SetCursorType,
  SetEditPathInfo,
  SetRotateItemsInfo,
  SetSelectionBox,
  SetSnapGuideInfo,
  SetSplitCurveInfo,
  SetToolMode,
  SetTooltipInfo,
  SetTransformPathsInfo,
  SetZoomPanInfo,
  SnapGuideInfo,
  SplitCurveInfo,
  TooltipInfo,
  TransformPathsInfo,
  ZoomPanInfo,
} from 'app/store/paper/actions';
import {
  getCreatePathInfo,
  getCursorType,
  getEditPathInfo,
  getRotateItemsInfo,
  getSelectionBox,
  getSnapGuideInfo,
  getSplitCurveInfo,
  getToolMode,
  getToolPanelState,
  getTooltipInfo,
  getTransformPathsInfo,
  getZoomPanInfo,
} from 'app/store/paper/selectors';
import { getAnimatedVectorLayer } from 'app/store/playback/selectors';
import * as _ from 'lodash';
import { OutputSelector } from 'reselect';
import { first } from 'rxjs/operators';

import { LayerTimelineService } from './layertimeline.service';

/** A simple service that provides an interface for making paper.js changes to the store. */
@Injectable()
export class PaperService {
  constructor(
    private readonly layerTimelineService: LayerTimelineService,
    private readonly store: Store<State>,
    // TODO: figure out if this is the most efficient use of NgZone...
    // TODO: can we get away with only executing in NgZone for certain dispatch store ops?
    private readonly ngZone: NgZone,
  ) {}

  observeToolPanelState() {
    return this.store.select(getToolPanelState);
  }

  enterEditPathMode() {
    this.setToolMode(ToolMode.Selection);
    this.setEditPathInfo({
      layerId: '',
      selectedSegments: new Set<number>(),
      visibleHandleIns: new Set<number>(),
      visibleHandleOuts: new Set<number>(),
      selectedHandleIn: undefined,
      selectedHandleOut: undefined,
    });
    this.setCursorType(CursorType.PenAdd);
  }

  enterRotateItemsMode() {
    this.setToolMode(ToolMode.Selection);
    this.setRotateItemsInfo({
      layerIds: this.getSelectedLayerIds(),
    });
  }

  enterTransformPathsMode() {
    this.setToolMode(ToolMode.Selection);
    this.setTransformPathsInfo({
      layerIds: this.getSelectedLayerIds(),
    });
  }

  enterCreateRectangleMode() {
    this.setToolMode(ToolMode.Rectangle);
    this.setCursorType(CursorType.Crosshair);
  }

  enterCreateEllipseMode() {
    this.setToolMode(ToolMode.Ellipse);
    this.setCursorType(CursorType.Crosshair);
  }

  /** Sets the current vector layer. */
  setVectorLayer(vl: VectorLayer) {
    // TODO: avoid running in angular zone whenever possible?
    this.ngZone.run(() => this.layerTimelineService.setVectorLayer(vl));
  }

  /** Gets the current vector layer. */
  getVectorLayer() {
    // TODO: return the non-animated vector layer here (using layer timeline service) instead?
    return this.queryStore(getAnimatedVectorLayer).vl;
  }

  /** Sets the set of selected layer IDs. */
  setSelectedLayerIds(layerIds: Set<string>) {
    if (!_.isEqual(this.queryStore(getSelectedLayerIds), layerIds)) {
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
    if (!_.isEqual(this.queryStore(getSelectionBox), box)) {
      // TODO: run this outside angular zone instead?
      this.dispatchStore(new SetSelectionBox(box));
    }
  }

  /** Gets the current selection box. */
  getSelectionBox() {
    return this.queryStore(getSelectionBox);
  }

  /** Sets the current create path info. */
  setCreatePathInfo(info: CreatePathInfo | undefined) {
    if (!_.isEqual(this.queryStore(getCreatePathInfo), info)) {
      this.dispatchStore(new SetCreatePathInfo(info));
    }
  }

  /** Gets the current create path info. */
  getCreatePathInfo() {
    return this.queryStore(getCreatePathInfo);
  }

  /** Sets the current split curve info. */
  setSplitCurveInfo(info: SplitCurveInfo | undefined) {
    if (!_.isEqual(this.queryStore(getSplitCurveInfo), info)) {
      this.dispatchStore(new SetSplitCurveInfo(info));
    }
  }

  /** Sets the current tool mode. */
  setToolMode(toolMode: ToolMode) {
    if (!_.isEqual(this.queryStore(getToolMode), toolMode)) {
      this.dispatchStore(new SetToolMode(toolMode));
    }
  }

  /** Gets the current tool mode. */
  getToolMode() {
    return this.queryStore(getToolMode);
  }

  setEditPathInfo(info: EditPathInfo | undefined) {
    if (!_.isEqual(this.queryStore(getEditPathInfo), info)) {
      this.dispatchStore(new SetEditPathInfo(info));
    }
  }

  getgetEditPathInfoInfo() {
    return this.queryStore(getEditPathInfo);
  }

  setRotateItemsInfo(info: RotateItemsInfo | undefined) {
    if (!_.isEqual(this.queryStore(getRotateItemsInfo), info)) {
      this.dispatchStore(new SetRotateItemsInfo(info));
    }
  }

  getRotateItemsInfo() {
    return this.queryStore(getRotateItemsInfo);
  }

  setTransformPathsInfo(info: TransformPathsInfo | undefined) {
    if (!_.isEqual(this.queryStore(getTransformPathsInfo), info)) {
      this.dispatchStore(new SetTransformPathsInfo(info));
    }
  }

  getTransformPathsInfo() {
    return this.queryStore(getTransformPathsInfo);
  }

  setCursorType(cursorType: CursorType) {
    if (!_.isEqual(this.queryStore(getCursorType), cursorType)) {
      this.dispatchStore(new SetCursorType(cursorType));
    }
  }

  /** Sets the current snap guide info. */
  setSnapGuideInfo(info: SnapGuideInfo | undefined) {
    if (!_.isEqual(this.queryStore(getSnapGuideInfo), info)) {
      this.dispatchStore(new SetSnapGuideInfo(info));
    }
  }

  /** Sets the current zoom/pan info. */
  setZoomPanInfo(info: ZoomPanInfo) {
    if (!_.isEqual(this.queryStore(getZoomPanInfo), info)) {
      this.dispatchStore(new SetZoomPanInfo(info));
    }
  }

  /** Sets the current tooltip info. */
  setTooltipInfo(info: TooltipInfo | undefined) {
    if (!_.isEqual(this.queryStore(getTooltipInfo), info)) {
      this.dispatchStore(new SetTooltipInfo(info));
    }
  }

  private dispatchStore<T>(action: Action<T>) {
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

  private queryStore<T>(selector: OutputSelector<Object, T, (...res: Object[]) => T>) {
    let obj: T;
    this.store
      .select(selector)
      .pipe(first())
      .subscribe(o => (obj = o));
    return obj;
  }
}
