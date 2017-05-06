import * as _ from 'lodash';
import {
  Component, OnInit, Input,
  Output, EventEmitter, ViewEncapsulation
} from '@angular/core';
import { Layer } from '../scripts/layers';
import { StateService } from '../services';
import { ModelUtil } from '../scripts/common';
import { Animation } from '../scripts/animations';

@Component({
  selector: 'app-layerlisttree',
  templateUrl: './layerlisttree.component.html',
  styleUrls: ['./layerlisttree.component.scss'],
  encapsulation: ViewEncapsulation.None,
  // TODO: remove view encapsulation=
})
export class LayerListTreeComponent implements OnInit, Callbacks {

  // MouseEvents from this layer (or children layers further down the tree)
  // are recursively handled by parent components until they reach
  // the LayerTimelineComponent.
  @Output() onLayerClick = new EventEmitter<LayerEvent>();
  @Output() onLayerDoubleClick = new EventEmitter<LayerEvent>();
  @Output() onLayerMouseDown = new EventEmitter<LayerEvent>();
  @Output() onAddTimelineBlockClick = new EventEmitter<TimelineBlockEvent>();

  @Input() layer: Layer;
  @Input() animations: Animation[];
  children: ReadonlyArray<Layer>;

  constructor(private readonly stateService: StateService) { }

  ngOnInit() {
    this.children = this.layer.children;
  }

  getLayerTypeName() {
    return ModelUtil.getLayerTypeName(this.layer);
  }

  getBlocksByAnimationByPropertyKeys() {
    return _.keys(ModelUtil.getBlocksByAnimationByProperty(this.layer.id, this.animations));
  }

  trackLayerFn(index: number, layer: Layer) {
    return layer.id; // TODO: will this be OK for renamed layers?
  }

  layerClick(event: MouseEvent, layer: Layer) {
    this.onLayerClick.emit({ event, layer });
  }

  layerDoubleClick(event: MouseEvent, layer: Layer) {
    this.onLayerDoubleClick.emit({ event, layer });
  }

  layerMouseDown(event: MouseEvent, layer: Layer) {
    this.onLayerMouseDown.emit({ event, layer });
  }

  addTimelineBlockClick(event: MouseEvent, layer: Layer, propertyName: string) {
    this.onAddTimelineBlockClick.emit({ event, layer, propertyName });
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
