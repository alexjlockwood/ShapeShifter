import { Injectable, NgZone } from '@angular/core';
import { VectorLayer } from 'app/modules/editor/model/layers';
import { CursorType, ToolMode } from 'app/modules/editor/model/paper';
import { Point } from 'app/modules/editor/scripts/common';
import { Action, State, Store } from 'app/modules/editor/store';
import { BatchAction } from 'app/modules/editor/store/batch/actions';
import { getHiddenLayerIds, getSelectedLayerIds } from 'app/modules/editor/store/layers/selectors';
import {
  CreatePathInfo,
  EditPathInfo,
  RotateItemsInfo,
  SetCreatePathInfo,
  SetCursorType,
  SetEditPathInfo,
  SetHoveredLayerId,
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
} from 'app/modules/editor/store/paper/actions';
import {
  getCreatePathInfo,
  getCursorType,
  getEditPathInfo,
  getHoveredLayerId,
  getRotateItemsInfo,
  getSelectionBox,
  getSnapGuideInfo,
  getSplitCurveInfo,
  getToolMode,
  getToolPanelState,
  getTooltipInfo,
  getTransformPathsInfo,
  getZoomPanInfo,
} from 'app/modules/editor/store/paper/selectors';
import { getAnimatedVectorLayer } from 'app/modules/editor/store/playback/selectors';
import * as _ from 'lodash';
import { OutputSelector } from 'reselect';
import { first } from 'rxjs/operators';

import { LayerTimelineService } from './layertimeline.service';

/** A simple service that provides an interface for making paper.js changes to the store. */
@Injectable({ providedIn: 'root' })
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

  enterDefaultMode() {
    this.setToolMode(ToolMode.Default);
    this.setEditPathInfo(undefined);
    this.setRotateItemsInfo(undefined);
    this.setTransformPathsInfo(undefined);
  }

  enterEditPathMode() {
    this.setToolMode(ToolMode.Default);
    this.setEditPathInfo({
      selectedSegments: new Set<number>(),
      visibleHandleIns: new Set<number>(),
      visibleHandleOuts: new Set<number>(),
      selectedHandleIn: undefined,
      selectedHandleOut: undefined,
    });
    this.setRotateItemsInfo(undefined);
    this.setTransformPathsInfo(undefined);
    this.setCursorType(CursorType.PenAdd);
  }

  /** Exits edit path mode. */
  exitEditPathMode() {
    this.dispatchStore(new BatchAction(...this.getExitEditPathModeActions()));
  }

  /** Returns a list of actions that will exit edit path mode. */
  getExitEditPathModeActions(): ReadonlyArray<Action> {
    return [new SetEditPathInfo(undefined), ...this.getClearEditPathModeStateActions()];
  }

  /** Returns a list of actions that will clear any state associated with edit path mode. */
  getClearEditPathModeStateActions(): ReadonlyArray<Action> {
    return [
      new SetCreatePathInfo(undefined),
      new SetSplitCurveInfo(undefined),
      new SetSnapGuideInfo(undefined),
      new SetCursorType(CursorType.Default),
    ];
  }

  enterRotateItemsMode() {
    this.setToolMode(ToolMode.Default);
    this.setEditPathInfo(undefined);
    this.setRotateItemsInfo({});
    this.setTransformPathsInfo(undefined);
  }

  enterTransformPathsMode() {
    this.setToolMode(ToolMode.Default);
    this.setEditPathInfo(undefined);
    this.setRotateItemsInfo(undefined);
    this.setTransformPathsInfo({});
  }

  enterPencilMode() {
    this.setToolMode(ToolMode.Pencil);
    this.setCursorType(CursorType.Pencil);
  }

  enterCreateRectangleMode() {
    this.setToolMode(ToolMode.Rectangle);
    this.setCursorType(CursorType.Crosshair);
  }

  enterCreateEllipseMode() {
    this.setToolMode(ToolMode.Ellipse);
    this.setCursorType(CursorType.Crosshair);
  }

  setVectorLayer(vl: VectorLayer) {
    // TODO: avoid running in angular zone whenever possible?
    this.ngZone.run(() => this.layerTimelineService.setVectorLayer(vl));
  }

  getVectorLayer() {
    // TODO: return the non-animated vector layer here (using layer timeline service) instead?
    return this.queryStore(getAnimatedVectorLayer).vl;
  }

  setSelectedLayerIds(layerIds: Set<string>) {
    if (!_.isEqual(this.queryStore(getSelectedLayerIds), layerIds)) {
      this.ngZone.run(() => this.layerTimelineService.setSelectedLayers(layerIds));
    }
  }

  getSelectedLayerIds() {
    return this.queryStore(getSelectedLayerIds);
  }

  setHoveredLayerId(layerId: string | undefined) {
    if (this.queryStore(getHoveredLayerId) !== layerId) {
      this.ngZone.run(() => this.store.dispatch(new SetHoveredLayerId(layerId)));
    }
  }

  getHoveredLayerId() {
    return this.queryStore(getHoveredLayerId);
  }

  getHiddenLayerIds() {
    return this.queryStore(getHiddenLayerIds);
  }

  setSelectionBox(box: { from: Point; to: Point } | undefined) {
    if (!_.isEqual(this.queryStore(getSelectionBox), box)) {
      // TODO: run this outside angular zone instead?
      this.dispatchStore(new SetSelectionBox(box));
    }
  }

  getSelectionBox() {
    return this.queryStore(getSelectionBox);
  }

  setCreatePathInfo(info: CreatePathInfo | undefined) {
    if (!_.isEqual(this.queryStore(getCreatePathInfo), info)) {
      this.dispatchStore(new SetCreatePathInfo(info));
    }
  }

  getCreatePathInfo() {
    return this.queryStore(getCreatePathInfo);
  }

  setSplitCurveInfo(info: SplitCurveInfo | undefined) {
    if (!_.isEqual(this.queryStore(getSplitCurveInfo), info)) {
      this.dispatchStore(new SetSplitCurveInfo(info));
    }
  }

  setToolMode(toolMode: ToolMode) {
    if (!_.isEqual(this.queryStore(getToolMode), toolMode)) {
      this.dispatchStore(new SetToolMode(toolMode));
    }
  }

  getToolMode() {
    return this.queryStore(getToolMode);
  }

  setEditPathInfo(info: EditPathInfo | undefined) {
    if (!_.isEqual(this.queryStore(getEditPathInfo), info)) {
      this.dispatchStore(new SetEditPathInfo(info));
    }
  }

  getEditPathInfo() {
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

  setSnapGuideInfo(info: SnapGuideInfo | undefined) {
    if (!_.isEqual(this.queryStore(getSnapGuideInfo), info)) {
      this.dispatchStore(new SetSnapGuideInfo(info));
    }
  }

  setZoomPanInfo(info: ZoomPanInfo) {
    if (!_.isEqual(this.queryStore(getZoomPanInfo), info)) {
      this.dispatchStore(new SetZoomPanInfo(info));
    }
  }

  setTooltipInfo(info: TooltipInfo | undefined) {
    if (!_.isEqual(this.queryStore(getTooltipInfo), info)) {
      this.dispatchStore(new SetTooltipInfo(info));
    }
  }

  deleteSelectedModels() {
    if (this.getRotateItemsInfo() || this.getTransformPathsInfo()) {
      // Do not delete layers when in rotate items or transform paths mode.
      return;
    }
    this.layerTimelineService.deleteSelectedModels();
  }

  getDeleteSelectedModelsActions() {
    return this.layerTimelineService.getDeleteSelectedModelsActions();
  }

  dispatchStore(action: Action) {
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
