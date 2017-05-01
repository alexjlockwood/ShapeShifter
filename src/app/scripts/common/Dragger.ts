import * as $ from 'jquery';
import { Point } from '.';

const DRAG_SLOP_PIXELS = 4;

export class Dragger {
  private direction_: string;
  private downX_: number;
  private downY_: number;
  private skipSlopCheck_: boolean;
  private draggingCursor_: string;
  private dragging_: boolean;
  private draggingScrim_: JQuery;
  private onBeginDrag_: (event: JQueryMouseEventObject) => void;
  private onDrag_: (event: JQueryMouseEventObject, point: Point) => void;
  private onDrop_: () => void;

  constructor(opts: ConstructorArgs = {}) {
    this.direction_ = opts.direction || 'both';
    this.downX_ = opts.downEvent.clientX;
    this.downY_ = opts.downEvent.clientY;
    this.skipSlopCheck_ = !!opts.skipSlopCheck;

    this.onBeginDrag_ = opts.onBeginDrag || (() => { });
    this.onDrag_ = opts.onDrag || (() => { });
    this.onDrop_ = opts.onDrop || (() => { });

    this.dragging_ = false;
    this.draggingScrim_ = undefined;

    this.draggingCursor = opts.draggingCursor || 'grabbing';

    const mouseMoveHandler_ = (event: JQueryMouseEventObject) => {
      if (!this.dragging_ && this.shouldBeginDragging_(event)) {
        this.dragging_ = true;
        this.draggingScrim_ = this.buildDraggingScrim_().appendTo(document.body);
        this.draggingCursor_ = this.draggingCursor_;
        this.onBeginDrag_(event);
      }

      if (this.dragging_) {
        this.onDrag_(event, new Point(
          event.clientX - this.downX_,
          event.clientY - this.downY_,
        ));
      }
    };

    const mouseUpHandler_ = (event: JQueryMouseEventObject) => {
      $(window)
        .off('mousemove', mouseMoveHandler_)
        .off('mouseup', mouseUpHandler_);

      if (this.dragging_) {
        this.onDrag_(event, new Point(
          event.clientX - this.downX_,
          event.clientY - this.downY_,
        ));

        this.onDrop_();

        this.draggingScrim_.remove();
        this.draggingScrim_ = null;
        this.dragging_ = false;

        event.stopPropagation();
        event.preventDefault();
        return false;
      }
      return undefined;
    };

    $(window)
      .on('mousemove', mouseMoveHandler_)
      .on('mouseup', mouseUpHandler_);
  }

  shouldBeginDragging_(mouseMoveEvent) {
    if (this.skipSlopCheck_) {
      return true;
    }

    let begin = false;
    if (this.direction_ === 'both' || this.direction_ === 'horizontal') {
      begin = begin || (Math.abs(mouseMoveEvent.clientX - this.downX_) > DRAG_SLOP_PIXELS);
    }
    if (this.direction_ === 'both' || this.direction_ === 'vertical') {
      begin = begin || (Math.abs(mouseMoveEvent.clientY - this.downY_) > DRAG_SLOP_PIXELS);
    }
    return begin;
  }

  set draggingCursor(cursor: string) {
    if (cursor === 'grabbing') {
      cursor = `-webkit-${cursor}`;
    }

    this.draggingCursor_ = cursor;
    if (this.draggingScrim_) {
      this.draggingScrim_.css({ cursor });
    }
  }

  buildDraggingScrim_() {
    return $('<div>')
      .css({
        position: 'fixed',
        left: 0,
        top: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999
      });
  }
}

interface ConstructorArgs {
  direction?: string;
  downEvent?: MouseEvent;
  skipSlopCheck?: boolean;
  onBeginDrag?: (event: JQueryMouseEventObject) => void;
  onDrag?: (event: JQueryMouseEventObject, point: Point) => void;
  onDrop?: () => void;
  draggingCursor?: string;
}
