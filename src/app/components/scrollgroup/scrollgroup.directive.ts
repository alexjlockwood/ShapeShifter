import { Directive, ElementRef, HostListener, Input, OnDestroy } from '@angular/core';
import * as $ from 'jquery';

const GROUPS = new Map<string, JQuery[]>();

@Directive({
  selector: '[appScrollGroup]',
})
export class ScrollGroupDirective implements OnDestroy {
  @Input() scrollGroup: string;

  private readonly element: JQuery;

  constructor(elementRef: ElementRef) {
    this.element = $(elementRef.nativeElement);
    GROUPS.set(this.scrollGroup, GROUPS.get(this.scrollGroup) || []);
    GROUPS.get(this.scrollGroup).push(this.element);
  }

  ngOnDestroy() {
    GROUPS.get(this.scrollGroup).splice(GROUPS.get(this.scrollGroup).indexOf(this.element), 1);
  }

  @HostListener('scroll', ['$event'])
  onScrollEvent(event: MouseEvent) {
    const scrollTop = this.element.scrollTop();
    GROUPS.get(this.scrollGroup).forEach(e => {
      if (this.element !== e) {
        e.scrollTop(scrollTop);
      }
    });
  }
}
