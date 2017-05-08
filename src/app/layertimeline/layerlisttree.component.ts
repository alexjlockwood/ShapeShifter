import * as _ from 'lodash';
import {
  Component, OnInit, Input, ChangeDetectionStrategy,
  Output, EventEmitter, ViewEncapsulation
} from '@angular/core';
import { Layer } from '../scripts/layers';
import { ModelUtil } from '../scripts/common';
import { Animation } from '../scripts/animations';

@Component({
  selector: 'app-layerlisttree',
  templateUrl: './layerlisttree.component.html',
  styleUrls: ['./layerlisttree.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // TODO: remove view encapsulation.
  encapsulation: ViewEncapsulation.None,
})
export class LayerListTreeComponent implements Callbacks {

  @Input() layer: Layer;
  @Input() animations: ReadonlyArray<Animation>;

  // MouseEvents from this layer (or children layers further down the tree)
  // are recursively handled by parent components until they reach
  // the LayerTimelineComponent.
  @Output() onLayerClick = new EventEmitter<LayerEvent>();
  @Output() onLayerDoubleClick = new EventEmitter<LayerEvent>();
  @Output() onLayerMouseDown = new EventEmitter<LayerEvent>();
  @Output() onAddTimelineBlockClick = new EventEmitter<TimelineBlockEvent>();

  // @Override Callbacks
  layerClick(event: MouseEvent, layer: Layer) {
    this.onLayerClick.emit({ event, layer });
  }

  // @Override Callbacks
  layerDoubleClick(event: MouseEvent, layer: Layer) {
    this.onLayerDoubleClick.emit({ event, layer });
  }

  // @Override Callbacks
  layerMouseDown(event: MouseEvent, layer: Layer) {
    this.onLayerMouseDown.emit({ event, layer });
  }

  // @Override Callbacks
  addTimelineBlockClick(event: MouseEvent, layer: Layer, propertyName: string) {
    this.onAddTimelineBlockClick.emit({ event, layer, propertyName });
  }

  // Used by *ngFor loop.
  trackLayerFn(index: number, layer: Layer) {
    return layer.id;
  }

  getBlocksByAnimationByPropertyKeys() {
    return _.keys(ModelUtil.getBlocksByAnimationByProperty(this.layer.name, this.animations));
  }
}

export interface Callbacks {
  layerClick(event: MouseEvent, layer: Layer);
  layerDoubleClick(event: MouseEvent, layer: Layer);
  layerMouseDown(event: MouseEvent, layer: Layer);
  addTimelineBlockClick(event: MouseEvent, layer: Layer, propertyName: string);
}

interface LayerEvent {
  readonly event: MouseEvent;
  readonly layer: Layer;
}

interface TimelineBlockEvent {
  readonly event: MouseEvent;
  readonly layer: Layer;
  readonly propertyName: string;
}
