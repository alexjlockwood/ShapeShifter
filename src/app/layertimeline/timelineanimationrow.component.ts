import * as _ from 'lodash';
import {
  Component, OnInit, Input, ViewEncapsulation,
  EventEmitter, Output, ChangeDetectionStrategy,
} from '@angular/core';
import { Layer } from '../scripts/layers';
import { Property } from '../scripts/properties';
import { Animation, AnimationBlock, NumberAnimationBlock } from '../scripts/animations';
import { ModelUtil } from '../scripts/common';

@Component({
  selector: 'app-timelineanimationrow',
  templateUrl: './timelineanimationrow.component.html',
  styleUrls: ['./timelineanimationrow.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // TODO: remove ViewEncapsulation.
  encapsulation: ViewEncapsulation.None,
})
export class TimelineAnimationRowComponent implements Callbacks {

  @Input() layer: Layer;
  @Input() animation: Animation;
  @Input() animations: Animation[];

  // MouseEvents from this layer (or children layers further down the tree)
  // are recursively handled by parent components until they reach
  // the LayerTimelineComponent.
  @Output() onTimelineBlockClick = new EventEmitter<Event>();
  @Output() onTimelineBlockMouseDown = new EventEmitter<Event>();

  getBlocksByAnimationByPropertyValues() {
    return _.values(ModelUtil.getBlocksByAnimationByProperty(this.layer.id, this.animations));
  }

  trackLayerFn(index: number, layer: Layer) {
    return layer.id; // TODO: will this be OK for renamed layers?
  }

  // TODO: figure out why this isn't being called when clicked?
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
