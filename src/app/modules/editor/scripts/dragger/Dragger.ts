import { Point } from 'app/modules/editor/scripts/common';

const DRAG_SLOP_PIXELS = 4;

export class Dragger {
  private readonly direction: Direction;
  private readonly downX: number;
  private readonly downY: number;
  private readonly shouldSkipSlopCheck: boolean;
  private readonly onBeginDragFn: (event: MouseEvent) => void;
  private readonly onDragFn: (event: MouseEvent, point: Point) => void;
  private readonly onDropFn: () => void;
  private draggingCursor_: string;
  private isDragging: boolean;
  private draggingScrim: HTMLDivElement;

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

    const mouseMoveHandlerFn = (event: MouseEvent) => {
      if (!this.isDragging && this.shouldBeginDragging(event)) {
        this.isDragging = true;
        this.draggingScrim = this.buildDraggingScrim();
        document.body.appendChild(this.draggingScrim);
        this.draggingCursor = this.draggingCursor_;
        this.onBeginDragFn(event);
      }

      if (this.isDragging) {
        this.onDragFn(event, { x: event.clientX - this.downX, y: event.clientY - this.downY });
      }
    };

    const mouseUpHandlerFn = (event: MouseEvent) => {
      window.removeEventListener('mousemove', mouseMoveHandlerFn);
      window.removeEventListener('mouseup', mouseUpHandlerFn);

      if (this.isDragging) {
        this.onDragFn(event, { x: event.clientX - this.downX, y: event.clientY - this.downY });

        this.onDropFn();

        this.draggingScrim.remove();
        this.draggingScrim = undefined;
        this.isDragging = false;

        event.stopPropagation();
        event.preventDefault();
      }
    };

    window.addEventListener('mousemove', mouseMoveHandlerFn);
    window.addEventListener('mouseup', mouseUpHandlerFn);
  }

  private shouldBeginDragging(mouseMoveEvent: MouseEvent) {
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
    this.draggingCursor_ = cursor;
    if (this.draggingScrim) {
      this.draggingScrim.style.cursor = cursor;
    }
  }

  private buildDraggingScrim() {
    const scrim = document.createElement('div');
    Object.assign(scrim.style, {
      position: 'fixed',
      left: '0',
      top: '0',
      right: '0',
      bottom: '0',
      zIndex: '9999',
    });
    return scrim;
  }
}

type Direction = 'horizontal' | 'vertical' | 'both';

interface ConstructorArgs {
  direction?: Direction;
  downX?: number;
  downY?: number;
  shouldSkipSlopCheck?: boolean;
  onBeginDragFn?: (event: MouseEvent) => void;
  onDragFn?: (event: MouseEvent, point: Point) => void;
  onDropFn?: () => void;
  draggingCursor?: string;
}
