import 'rxjs/add/operator/first';

import { Injectable } from '@angular/core';
import { VectorLayer } from 'app/model/layers';
import { ToolMode } from 'app/model/paper';
import { Matrix, Point } from 'app/scripts/common';
import { State, Store } from 'app/store';
import { SetHoveredLayer } from 'app/store/layers/actions';
import { getHoveredLayerId, getSelectedLayerIds, getVectorLayer } from 'app/store/layers/selectors';
import { SetPathPreview, SetSelectionBox, SetToolMode } from 'app/store/paper/actions';
import { getPathPreview, getSelectionBox, getToolMode } from 'app/store/paper/selectors';
import * as _ from 'lodash';
import { OutputSelector } from 'reselect';

import { LayerTimelineService } from './layertimeline.service';

/**
 * A simple service that provides an interface for making paper.js
 * changes to the store.
 */
@Injectable()
export class PaperService {
  constructor(
    private readonly layerTimelineService: LayerTimelineService,
    public readonly store: Store<State>,
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

  /** Sets the currently hovered layer id (or clears it if the layer id is undefined). */
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

  /** Sets the current path preview. */
  setPathPreview(pathData: string) {
    if (this.getPathPreview() !== pathData) {
      this.store.dispatch(new SetPathPreview(pathData));
    }
  }

  /** Gets the current path preview. */
  getPathPreview() {
    return this.queryStore(getPathPreview);
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

  private queryStore<T>(selector: OutputSelector<Object, T, (res: Object) => T>) {
    let obj: T;
    this.store
      .select(selector)
      .first()
      .subscribe(o => (obj = o));
    return obj;
  }
}
