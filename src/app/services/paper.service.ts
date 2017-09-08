import 'rxjs/add/operator/first';

import { Injectable } from '@angular/core';
import { ToolMode } from 'app/model/paper';
import { Point } from 'app/scripts/common';
import { State, Store } from 'app/store';
import { SetHoveredLayer } from 'app/store/layers/actions';
import { getHoveredLayerId, getSelectedLayerIds, getVectorLayer } from 'app/store/layers/selectors';
import {
  SetFillColor,
  SetSelectionBox,
  SetStrokeColor,
  SetToolMode,
} from 'app/store/paper/actions';
import {
  getFillColor,
  getSelectionBox,
  getStrokeColor,
  getToolMode,
} from 'app/store/paper/selectors';
import * as _ from 'lodash';
import { OutputSelector } from 'reselect';

import { LayerTimelineService } from './layertimeline.service';

/**
 * A simple service that provides an interface for making paper.js changes.
 */
@Injectable()
export class PaperService {
  constructor(
    private readonly layerTimelineService: LayerTimelineService,
    public readonly store: Store<State>,
  ) {}

  setSelectedLayers(layerIds: Set<string>) {
    this.layerTimelineService.setSelectedLayers(layerIds);
  }

  getSelectedLayers() {
    return this.queryStore(getSelectedLayerIds);
  }

  /** Sets the hovered layer. */
  setHoveredLayer(layerId: string | undefined) {
    if (this.queryStore(getHoveredLayerId) !== layerId) {
      this.store.dispatch(new SetHoveredLayer(layerId));
    }
  }

  setSelectionBox(box: { from: Point; to: Point } | undefined) {
    if (!_.isEqual(this.getSelectionBox(), box)) {
      this.store.dispatch(new SetSelectionBox(box));
    }
  }

  getSelectionBox() {
    return this.queryStore(getSelectionBox);
  }

  // Tool modes.

  setToolMode(toolMode: ToolMode) {
    if (this.getToolMode() !== toolMode) {
      this.store.dispatch(new SetToolMode(toolMode));
    }
  }

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
