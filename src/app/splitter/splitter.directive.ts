import { Directive, Output, EventEmitter, ElementRef, HostListener } from '@angular/core';
import { Point } from '../scripts/mathutil';

@Directive({
  selector: '[appSplitter]'
})
export class SplitterDirective {
  @Output() onDividerDrag: EventEmitter<{ start: Point, move: Point, end: Point }> = new EventEmitter();

  private start: Point;

  constructor() { }

  @HostListener('mousedown') onMouseDown(event: MouseEvent) {
    event = event || <MouseEvent>window.event;
    event.stopPropagation();
    event.preventDefault();
    if (event.pageX) {
      this.start = new Point(event.pageX, event.pageY);
    } else if (event.clientX) {
      this.start = new Point(event.clientX, event.clientY);
    }
    if (this.start) {
      this.onDividerDrag.emit({
        start: this.start,
        move: null,
        end: null,
      });

      document.body.onmousemove = (e: MouseEvent) => {
        e = e || <MouseEvent>window.event;
        e.stopPropagation();
        e.preventDefault();
        let endX = 0;
        let endY = 0;
        if (e.pageX) {
          endX = e.pageX;
          endY = e.pageY;
        } else if (e.clientX) {
          endX = e.clientX;
          endY = e.clientX;
        }
        this.onDividerDrag.emit({
          start: this.start,
          move: new Point(endX - this.start.x, endY - this.start.y),
          end: null,
        });
      };

      document.body.onmouseup = (e: MouseEvent) => {
        document.body.onmousemove = document.body.onmouseup = null;
        e = e || <MouseEvent>window.event;
        e.stopPropagation();
        e.preventDefault();
        let endX = 0;
        let endY = 0;
        if (e.pageX) {
          endX = e.pageX;
          endY = e.pageY;
        } else if (e.clientX) {
          endX = e.clientX;
          endY = e.clientX;
        }
        this.onDividerDrag.emit({
          start: this.start,
          move: new Point(endX - this.start.x, endY - this.start.y),
          end: new Point(endX - this.start.x, endY - this.start.y),
        });
        this.start = undefined;
      };
    }
  }
}
