import {
  Component, ElementRef, HostListener, Input, OnInit, ViewEncapsulation,
} from '@angular/core';
import * as $ from 'jquery';
import { Dragger } from '../scripts/dragger';

// TODO: remove the view encapsulation stuff here
@Component({
  selector: 'app-splitter',
  templateUrl: './splitter.component.html',
  styleUrls: ['./splitter.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class SplitterComponent implements OnInit {
  @Input() edge: string;
  @Input() min: number;
  @Input() persistId: string;

  private element: JQuery;
  private parent: JQuery;
  private persistKey: string;
  private orientation: string;
  private sizeGetterFn: () => number;
  private sizeSetterFn: (size: number) => void;
  private clientXY: string;

  constructor(private readonly elementRef: ElementRef) { }

  ngOnInit() {
    this.element = $(this.elementRef.nativeElement);
    if (this.min === undefined || this.min <= 0) {
      this.min = 100;
    }
    if (this.persistId) {
      this.persistKey = `\$\$splitter::${this.persistId}`;
    }
    this.orientation =
      this.edge === 'left' || this.edge === 'right' ? 'vertical' : 'horizontal';
    this.parent = this.element.parent();

    if (this.orientation === 'vertical') {
      this.sizeGetterFn = () => this.parent.width();
      this.sizeSetterFn = size => this.parent.width(size);
      this.clientXY = 'clientX';

    } else {
      this.sizeGetterFn = () => this.parent.height();
      this.sizeSetterFn = size => this.parent.height(size);
      this.clientXY = 'clientY';
    }

    this.addClasses();
    this.setupEventListeners();
    this.deserializeState();
  }

  private deserializeState() {
    if (this.persistKey in localStorage) {
      this.setSize_(Number(localStorage[this.persistKey]));
    }
  }

  private addClasses() {
    this.element
      .addClass(`splt-${this.orientation}`)
      .addClass(`splt-edge-${this.edge}`);
  }

  private setupEventListeners() {
    this.element.on('mousedown', event => {
      const downSize = this.sizeGetterFn();
      event.preventDefault();

      new Dragger({
        downX: event.clientX,
        downY: event.clientY,
        direction: (this.orientation === 'vertical') ? 'horizontal' : 'vertical',
        draggingCursor: (this.orientation === 'vertical') ? 'col-resize' : 'row-resize',

        onBeginDragFn: () => this.element.addClass('is-dragging'),
        onDragFn: (_, p) => {
          const sign = (this.edge === 'left' || this.edge === 'top') ? -1 : 1;
          const d = this.orientation === 'vertical' ? p.x : p.y;
          this.setSize_(Math.max(this.min, downSize + sign * d));
        },
        onDropFn: () => this.element.removeClass('is-dragging'),
      });
    });
  }

  setSize_(size) {
    if (this.persistKey) {
      localStorage[this.persistKey] = size;
    }
    this.sizeSetterFn(size);
  }

  @HostListener('mouseenter', ['$event'])
  onMouseEnter() {
    this.elementRef.nativeElement.style.backgroundColor = 'rgba(0, 0, 0, 0.1)';
  }

  @HostListener('mouseleave', ['$event'])
  onMouseLeave() {
    if (!this.element.hasClass('is-dragging')) {
      this.elementRef.nativeElement.style.backgroundColor = undefined;
    }
  }
}
