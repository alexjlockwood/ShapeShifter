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

  // TODO: this doesn't get called (unlike the click event in layer list tree)!!!!
  // TODO: this doesn't get called (unlike the click event in layer list tree)!!!!
  // TODO: this doesn't get called (unlike the click event in layer list tree)!!!!
  // TODO: this doesn't get called (unlike the click event in layer list tree)!!!!
  // TODO: this doesn't get called (unlike the click event in layer list tree)!!!!
  // @Override Callbacks
  timelineBlockClick(
    event: MouseEvent,
    block: AnimationBlock<any>,
    animation: Animation,
    layer: Layer,
  ) {
    this.onTimelineBlockClick.emit({ event, block, animation, layer });
  }

  // @Override Callbacks
  timelineBlockMouseDown(
    event: MouseEvent,
    block: AnimationBlock<any>,
    animation: Animation,
    layer: Layer,
  ) {
    this.onTimelineBlockMouseDown.emit({ event, block, animation, layer });
    return false;
  }

  // Used by *ngFor loop.
  trackLayerFn(index: number, layer: Layer) {
    return layer.name; // TODO: will this be OK for renamed layers?
  }

  getBlocksByAnimationByPropertyValues() {
    return _.values(ModelUtil.getBlocksByAnimationByProperty(this.layer.name, this.animations));
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
