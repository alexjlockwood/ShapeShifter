import { Component, ElementRef, HostListener, ChangeDetectionStrategy } from '@angular/core';
import { Point } from '../scripts/common';
import * as $ from 'jquery';

// TODO: this constant should always be equal to the inspector toolbar size... enforce this!
const MIN_PARENT_HEIGHT = 40;

@Component({
  selector: 'app-splitter',
  templateUrl: './splitter.component.html',
  styleUrls: ['./splitter.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SplitterComponent {
  private downPoint: Point;
  private isHovering = false;
  private downHeight: number;
  private readonly parent: JQuery;

  constructor(private element: ElementRef) {
    this.parent = $(element.nativeElement).parent();
  }

  isHighlighted() {
    return this.isHovering || !!this.downPoint;
  }

  @HostListener('mouseenter', ['$event'])
  onMouseEnter(event: MouseEvent) {
    this.isHovering = true;
  }

  @HostListener('mouseleave', ['$event'])
  onMouseLeave(event: MouseEvent) {
    this.isHovering = false;
  }

  @HostListener('mousedown', ['$event'])
  onMouseDown(event: MouseEvent) {
    this.downHeight = this.parent.height();
    event = event || window.event as MouseEvent;
    event.stopPropagation();
    event.preventDefault();
    if (event.pageX) {
      this.downPoint = new Point(event.pageX, event.pageY);
    } else if (event.clientX) {
      this.downPoint = new Point(event.clientX, event.clientY);
    }
    if (this.downPoint) {
      document.body.onmousemove = (e: MouseEvent) => {
        e = e || window.event as MouseEvent;
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
        this.parent.height(Math.max(MIN_PARENT_HEIGHT, this.downHeight - (endY - this.downPoint.y)));
      };

      document.body.onmouseup = (e: MouseEvent) => {
        document.body.onmousemove = document.body.onmouseup = undefined;
        e = e || window.event as MouseEvent;
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
        this.parent.height(Math.max(MIN_PARENT_HEIGHT, this.downHeight - (endY - this.downPoint.y)));
        this.downPoint = undefined;
      };
    }
  }
}


