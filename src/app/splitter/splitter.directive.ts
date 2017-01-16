import { OnInit, Directive, Output, EventEmitter, ElementRef, HostListener } from '@angular/core';
import { Point } from '../scripts/common';

@Directive({
  selector: '[appSplitter]'
})
export class SplitterDirective implements OnInit {
  @Output() onDividerDrag = new EventEmitter<DividerDragEvent>();

  private start: Point;

  constructor(private element: ElementRef) { }

  ngOnInit() {
    this.element.nativeElement.style.position = 'relative';
    this.element.nativeElement.style.cursor = 'row-resize';
  }

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
        move: undefined,
        end: undefined,
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
          move: new Point(endX, endY),
          end: undefined,
        });
      };

      document.body.onmouseup = (e: MouseEvent) => {
        document.body.onmousemove = document.body.onmouseup = undefined;
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
          move: new Point(endX, endY),
          end: new Point(endX, endY),
        });
        this.start = undefined;
      };
    }
  }
}

export interface DividerDragEvent {
  start: Point;
  move?: Point;
  end?: Point;
};


