import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
  ViewEncapsulation,
} from '@angular/core';
import { AnimationMap, ModelUtil } from 'app/scripts/common';
import { Layer } from 'app/scripts/model/layers';
import { Animation, AnimationBlock } from 'app/scripts/model/timeline';
import { State, Store } from 'app/store';
import { getTimelineAnimationRowState } from 'app/store/common/selectors';
import * as _ from 'lodash';
import { Observable } from 'rxjs/Observable';

@Component({
  selector: 'app-timelineanimationrow',
  templateUrl: './timelineanimationrow.component.html',
  styleUrls: ['./timelineanimationrow.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // TODO: remove ViewEncapsulation.
  encapsulation: ViewEncapsulation.None,
})
export class TimelineAnimationRowComponent implements OnInit, Callbacks {

  animationRowModel$: Observable<AnimationRowModel>;

  @Input() layer: Layer;
  @Input() animation: Layer;

  // MouseEvents from this layer (or children layers further down the tree)
  // are recursively handled by parent components until they reach
  // the LayerTimelineComponent.
  @Output() onTimelineBlockClick = new EventEmitter<Event>();
  @Output() onTimelineBlockMouseDown = new EventEmitter<Event>();

  constructor(private readonly store: Store<State>) { }

  ngOnInit() {
    this.animationRowModel$ =
      this.store.select(getTimelineAnimationRowState)
        .map(({ animation, collapsedLayerIds, selectedBlockIds }) => {
          // Returns a list of animation block lists. Each animation block list corresponds to
          // a property name displayed in the layer list tree.
          const blocksByPropertyNameValues =
            _.values(ModelUtil.getOrderedBlocksByPropertyByLayer(animation)[this.layer.id]);
          return {
            blocksByPropertyNameValues,
            isExpanded: !collapsedLayerIds.has(this.layer.id),
            selectedBlockIds,
          };
        });
  }

  // @Override Callbacks
  timelineBlockClick(
    event: MouseEvent,
    block: AnimationBlock,
    animation: Animation,
    layer: Layer,
  ) {
    this.onTimelineBlockClick.emit({ event, block, animation, layer });
  }

  // @Override Callbacks
  timelineBlockMouseDown(
    event: MouseEvent,
    block: AnimationBlock,
    animation: Animation,
    layer: Layer,
  ) {
    this.onTimelineBlockMouseDown.emit({ event, block, animation, layer });
  }

  // Used by *ngFor loop.
  trackLayerFn(index: number, layer: Layer) {
    return layer.id;
  }
}

export interface Callbacks {
  timelineBlockMouseDown(
    event: MouseEvent,
    block: AnimationBlock,
    animation: Animation,
    layer: Layer,
  );
  timelineBlockClick(
    event: MouseEvent,
    block: AnimationBlock,
    animation: Animation,
    layer: Layer,
  );
}

interface AnimationRowModel {
  readonly blocksByPropertyNameValues: ReadonlyArray<ReadonlyArray<AnimationBlock>>;
  readonly isExpanded: boolean;
  readonly selectedBlockIds: Set<string>;
}

interface Event {
  readonly event: MouseEvent;
  readonly block: AnimationBlock;
  readonly animation: Animation;
  readonly layer: Layer;
}
