import * as _ from 'lodash';
import { Component, OnInit, Input, ViewEncapsulation } from '@angular/core';
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
export class TimelineAnimationRowComponent implements OnInit {
  @Input() layer: Layer;
  @Input() animation: Animation;
  @Input() animations: Animation[];

  constructor() { }

  ngOnInit() {
  }

  getLayerTypeName() {
    return ModelUtil.getLayerTypeName(this.layer);
  }

  getBlocksByAnimationByPropertyValues() {
    return _.values(ModelUtil.getBlocksByAnimationByProperty(this.layer.id, this.animations));
  }

  onTimelineBlockClick(
    event: MouseEvent,
    block: AnimationBlock<any>,
    animation: Animation,
    layer: Layer,
  ) {
    console.info('onTimelineBlockClick');
  }

  onTimelineBlockMouseDown(
    event: MouseEvent,
    block: AnimationBlock<any>,
    animation: Animation,
    layer: Layer,
  ) {
    console.info('onTimelineBlockMouseDown');
  }
}
