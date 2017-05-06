import * as _ from 'lodash';
import {
  Component, OnInit, Input, ViewEncapsulation,
  EventEmitter, Output,
} from '@angular/core';
import { Layer } from '../scripts/layers';
import { Property } from '../scripts/properties';
import { Animation, AnimationBlock, NumberAnimationBlock } from '../scripts/animations';
import { ModelUtil } from '../scripts/common';

@Component({
  selector: 'app-timelineanimationrow',
  templateUrl: './timelineanimationrow.component.html',
  styleUrls: ['./timelineanimationrow.component.scss'],
  encapsulation: ViewEncapsulation.None,
  // TODO: make OnPush and remove ViewEncapsulation
})
export class TimelineAnimationRowComponent implements Callbacks {

  // MouseEvents from this layer (or children layers further down the tree)
  // are recursively handled by parent components until they reach
  // the LayerTimelineComponent.
  @Output() onTimelineBlockClick = new EventEmitter<Event>();
  @Output() onTimelineBlockMouseDown = new EventEmitter<Event>();

  @Input() layer: Layer;
  @Input() animation: Animation;
  @Input() animations: Animation[];

  getLayerTypeName() {
    return ModelUtil.getLayerTypeName(this.layer);
  }

  getBlocksByAnimationByPropertyValues() {
    return _.values(ModelUtil.getBlocksByAnimationByProperty(this.layer.id, this.animations));
  }

  trackLayerFn(index: number, layer: Layer) {
    return layer.id; // TODO: will this be OK for renamed layers?
  }

  timelineBlockClick(
    event: MouseEvent,
    block: AnimationBlock<any>,
    animation: Animation,
    layer: Layer,
  ) {
    this.onTimelineBlockClick.emit({ event, block, animation, layer });
  }

  timelineBlockMouseDown(
    event: MouseEvent,
    block: AnimationBlock<any>,
    animation: Animation,
    layer: Layer,
  ) {
    this.onTimelineBlockMouseDown.emit({ event, block, animation, layer });
  }
}

export interface Callbacks {
  timelineBlockClick(
    event: MouseEvent,
    block: AnimationBlock<any>,
    animation: Animation,
    layer: Layer,
  );
  timelineBlockMouseDown(
    event: MouseEvent,
    block: AnimationBlock<any>,
    animation: Animation,
    layer: Layer,
  );
}

interface Event {
  readonly event: MouseEvent;
  readonly block: AnimationBlock<any>;
  readonly animation: Animation;
  readonly layer: Layer;
}
