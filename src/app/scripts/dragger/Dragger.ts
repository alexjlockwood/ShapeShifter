import { Point } from 'app/scripts/common';
import * as $ from 'jquery';

const DRAG_SLOP_PIXELS = 4;

export class Dragger {
  private readonly direction: Direction;
  private readonly downX: number;
  private readonly downY: number;
  private readonly shouldSkipSlopCheck: boolean;
  private readonly onBeginDragFn: (event: JQuery.Event) => void;
  private readonly onDragFn: (event: JQuery.Event, point: Point) => void;
  private readonly onDropFn: () => void;
  private draggingCursor_: string;
  private isDragging: boolean;
  private draggingScrim: JQuery;

  constructor(opts: ConstructorArgs = {}) {
    this.direction = opts.direction || 'both';
    this.downX = opts.downX;
    this.downY = opts.downY;
    this.shouldSkipSlopCheck = !!opts.shouldSkipSlopCheck;

    this.onBeginDragFn = opts.onBeginDragFn || (() => {});
    this.onDragFn = opts.onDragFn || (() => {});
    this.onDropFn = opts.onDropFn || (() => {});

    this.isDragging = false;
    this.draggingScrim = undefined;

    this.draggingCursor = opts.draggingCursor || 'grabbing';

    const mouseMoveHandlerFn = (event: JQuery.Event) => {
      if (!this.isDragging && this.shouldBeginDragging(event)) {
        this.isDragging = true;
        this.draggingScrim = this.buildDraggingScrim().appendTo(document.body);
        this.draggingCursor = this.draggingCursor_;
        this.onBeginDragFn(event);
      }

      if (this.isDragging) {
        this.onDragFn(event, { x: event.clientX - this.downX, y: event.clientY - this.downY });
      }
    };

    const mouseUpHandlerFn = (event: JQuery.Event) => {
      $(window).off('mousemove', mouseMoveHandlerFn).off('mouseup', mouseUpHandlerFn);

      if (this.isDragging) {
        this.onDragFn(event, { x: event.clientX - this.downX, y: event.clientY - this.downY });

        this.onDropFn();

        this.draggingScrim.remove();
        this.draggingScrim = undefined;
        this.isDragging = false;

        event.stopPropagation();
        event.preventDefault();
        return false;
      }
      return undefined;
    };

    $(window).on('mousemove', mouseMoveHandlerFn).on('mouseup', mouseUpHandlerFn);
  }

  private shouldBeginDragging(mouseMoveEvent: JQuery.Event) {
    if (this.shouldSkipSlopCheck) {
      return true;
    }
    let begin = false;
    if (this.direction === 'both' || this.direction === 'horizontal') {
      begin = begin || Math.abs(mouseMoveEvent.clientX - this.downX) > DRAG_SLOP_PIXELS;
    }
    if (this.direction === 'both' || this.direction === 'vertical') {
      begin = begin || Math.abs(mouseMoveEvent.clientY - this.downY) > DRAG_SLOP_PIXELS;
    }
    return begin;
  }

  private set draggingCursor(cursor: string) {
    if (cursor === 'grabbing') {
      cursor = `-webkit-${cursor}`;
    }

    this.draggingCursor_ = cursor;
    if (this.draggingScrim) {
      this.draggingScrim.css({ cursor });
    }
  }

  private buildDraggingScrim() {
    return $('<div>').css({
      position: 'fixed',
      left: 0,
      top: 0,
      right: 0,
      bottom: 0,
      zIndex: 9999,
    });
  }
}

type Direction = 'horizontal' | 'vertical' | 'both';

interface ConstructorArgs {
  direction?: Direction;
  downX?: number;
  downY?: number;
  shouldSkipSlopCheck?: boolean;
  onBeginDragFn?: (event: JQuery.Event) => void;
  onDragFn?: (event: JQuery.Event, point: Point) => void;
  onDropFn?: () => void;
  draggingCursor?: string;
}
