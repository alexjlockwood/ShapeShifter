import 'rxjs/add/operator/map';

import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
} from '@angular/core';
import { Layer } from 'app/model/layers';
import { Animation, AnimationBlock } from 'app/model/timeline';
import { ModelUtil } from 'app/scripts/common';
import { ActionModeService } from 'app/services';
import { State, Store } from 'app/store';
import { getTimelineAnimationRowState } from 'app/store/common/selectors';
import * as _ from 'lodash';
import { Observable } from 'rxjs/Observable';

@Component({
  selector: 'app-timelineanimationrow',
  templateUrl: './timelineanimationrow.component.html',
  styleUrls: ['./timelineanimationrow.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TimelineAnimationRowComponent implements OnInit, Callbacks {
  animationRowModel$: Observable<AnimationRowModel>;

  @Input() layer: Layer;

  // MouseEvents from this layer (or children layers further down the tree)
  // are recursively handled by parent components until they reach
  // the LayerTimelineComponent.
  @Output() timelineBlockClick = new EventEmitter<AnimationRowEvent>();
  @Output() timelineBlockMouseDown = new EventEmitter<AnimationRowEvent>();
  @Output() timelineBlockDoubleClick = new EventEmitter<AnimationRowEvent>();

  constructor(
    private readonly store: Store<State>,
    private readonly actionModeService: ActionModeService,
  ) {}

  ngOnInit() {
    this.animationRowModel$ = this.store
      .select(getTimelineAnimationRowState)
      .map(({ animation, collapsedLayerIds, selectedBlockIds, isActionMode }) => {
        // Returns a list of animation block lists. Each animation block list corresponds to
        // a property name displayed in the layer list tree.
        const blocksByPropertyNameValues = _.values(
          ModelUtil.getOrderedBlocksByPropertyByLayer(animation)[this.layer.id],
        );
        return {
          animation,
          blocksByPropertyNameValues,
          isExpanded: !collapsedLayerIds.has(this.layer.id),
          selectedBlockIds,
          isActionMode,
        };
      });
  }

  // @Override Callbacks
  onTimelineBlockClick(event: MouseEvent, block: AnimationBlock) {
    event.stopPropagation();
    if (!this.actionModeService.isActionMode()) {
      this.timelineBlockClick.emit({ event, block });
    }
  }

  // @Override Callbacks
  onTimelineBlockDoubleClick(event: MouseEvent, block: AnimationBlock) {
    event.stopPropagation();
    if (!this.actionModeService.isActionMode()) {
      this.timelineBlockDoubleClick.emit({ event, block });
    }
  }

  // @Override Callbacks
  onTimelineBlockMouseDown(event: MouseEvent, block: AnimationBlock) {
    if (!this.actionModeService.isActionMode()) {
      this.timelineBlockMouseDown.emit({ event, block });
    }
  }

  // Used by *ngFor loop.
  trackLayerFn(index: number, layer: Layer) {
    return layer.id;
  }
}

export interface Callbacks {
  onTimelineBlockMouseDown(event: MouseEvent, block: AnimationBlock): void;
  onTimelineBlockClick(event: MouseEvent, block: AnimationBlock): void;
  onTimelineBlockDoubleClick(event: MouseEvent, block: AnimationBlock): void;
}

interface AnimationRowEvent {
  readonly event: MouseEvent;
  readonly block: AnimationBlock;
}

interface AnimationRowModel {
  readonly animation: Animation;
  readonly blocksByPropertyNameValues: ReadonlyTable<AnimationBlock>;
  readonly isExpanded: boolean;
  readonly selectedBlockIds: ReadonlySet<string>;
  readonly isActionMode: boolean;
}
