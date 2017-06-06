import { Dragger } from '../dragger';
import {
  Component,
  ElementRef,
  HostBinding,
  HostListener,
  Input,
  OnInit,
  ViewEncapsulation,
} from '@angular/core';
import * as $ from 'jquery';

type Orientation = 'vertical' | 'horizontal';
type Edge = 'left' | 'right' | 'top';

@Component({
  selector: 'app-splitter',
  templateUrl: './splitter.component.html',
  styleUrls: ['./splitter.component.scss'],
  // TODO: remove view encapsulation here
  encapsulation: ViewEncapsulation.None,
})
export class SplitterComponent implements OnInit {
  @Input() edge: Edge;
  @Input() min: number;
  @Input() persistId: string;
  @HostBinding('class') classNames = '';
  @HostBinding('style.backgroundColor') backgroundColor = '';

  private persistKey: string;
  private orientation: Orientation;
  private sizeGetterFn: () => number;
  private sizeSetterFn: (size: number) => void;
  private clientXY: string;

  private isHovering = false;
  private isDragging = false;

  constructor(private readonly elementRef: ElementRef) { }

  ngOnInit() {
    if (this.min === undefined || this.min <= 0) {
      this.min = 100;
    }
    if (this.persistId) {
      this.persistKey = `\$\$splitter::${this.persistId}`;
    }
    this.orientation =
      this.edge === 'left' || this.edge === 'right' ? 'vertical' : 'horizontal';
    this.classNames = `splt-${this.orientation} splt-edge-${this.edge}`;
    const getParentFn = () => $(this.elementRef.nativeElement).parent();
    if (this.orientation === 'vertical') {
      this.sizeGetterFn = () => getParentFn().width();
      this.sizeSetterFn = size => getParentFn().width(size);
      this.clientXY = 'clientX';
    } else {
      this.sizeGetterFn = () => getParentFn().height();
      this.sizeSetterFn = size => getParentFn().height(size);
      this.clientXY = 'clientY';
    }
    if (this.persistKey in localStorage) {
      this.setSize(Number(localStorage[this.persistKey]));
    }
  }

  private setSize(size: number) {
    if (this.persistKey) {
      localStorage[this.persistKey] = size;
    }
    this.sizeSetterFn(size);
  }

  @HostListener('mousedown', ['$event'])
  onMouseDown(event: MouseEvent) {
    const downSize = this.sizeGetterFn();
    event.preventDefault();

    this.isDragging = true;
    this.showSplitter();

    // tslint:disable-next-line
    new Dragger({
      downX: event.clientX,
      downY: event.clientY,
      direction: (this.orientation === 'vertical') ? 'horizontal' : 'vertical',
      draggingCursor: (this.orientation === 'vertical') ? 'col-resize' : 'row-resize',
      onBeginDragFn: () => {
        this.isDragging = true;
        this.showSplitter();
      },
      onDragFn: (_, p) => {
        const sign = (this.edge === 'left' || this.edge === 'top') ? -1 : 1;
        const d = this.orientation === 'vertical' ? p.x : p.y;
        this.setSize(Math.max(this.min, downSize + sign * d));
      },
      onDropFn: () => {
        this.isDragging = false;
        this.hideSplitter();
      },
    });
  }

  @HostListener('mouseenter')
  onMouseEnter() {
    this.isHovering = true;
    this.showSplitter();
  }

  @HostListener('mouseleave')
  onMouseLeave() {
    this.isHovering = false;
    this.hideSplitter();
  }

  private showSplitter() {
    if (this.isDragging || this.isHovering) {
      this.backgroundColor = 'rgba(0, 0, 0, 0.1)';
    }
  }

  private hideSplitter() {
    if (!this.isDragging && !this.isHovering) {
      this.backgroundColor = 'transparent';
    }
  }
}
