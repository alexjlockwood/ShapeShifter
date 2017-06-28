import { Directive, ElementRef, EventEmitter, HostListener, OnInit, Output } from '@angular/core';
import * as $ from 'jquery';

enum DragState {
  None = 0,
  Dragging,
  Loading,
}

@Directive({
  selector: '[appDropTarget]',
})
export class DropTargetDirective implements OnInit {
  @Output() onDropFiles = new EventEmitter<FileList>();

  private element: JQuery;
  private dragState = DragState.None;
  private notDraggingTimeoutId: number;

  constructor(private readonly elementRef: ElementRef) {}

  ngOnInit() {
    this.element = $(this.elementRef.nativeElement);
    this.element.addClass('file-drop-target');
  }

  @HostListener('dragenter', ['$event'])
  onDragEnter(event: DragEvent) {
    event.preventDefault();
    this.setDragging(true);
    return false;
  }

  @HostListener('dragover', ['$event'])
  onDragOver(event: DragEvent) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    return false;
  }

  @HostListener('dragleave', ['$event'])
  onDragLeave(event: DragEvent) {
    event.preventDefault();
    this.setDragging(false);
    return false;
  }

  @HostListener('drop', ['$event'])
  onDrop(event: DragEvent) {
    this.setDragState(DragState.None);
    this.onDropFiles.emit(event.dataTransfer.files);
    return false;
  }

  private setDragState(state: DragState) {
    this.dragState = state;
    this.element.toggleClass('is-dragging-over', this.dragState === DragState.Dragging);
    this.element.toggleClass('is-loading', this.dragState === DragState.Loading);
  }

  // Set up drag event listeners, with debouncing because dragging over/out
  // of each child triggers these events on the element.
  private setDragging(isDragging: boolean) {
    if (isDragging) {
      // When moving from child to child, dragenter is sent before dragleave
      // on previous child.
      window.setTimeout(() => {
        if (this.notDraggingTimeoutId) {
          window.clearTimeout(this.notDraggingTimeoutId);
          this.notDraggingTimeoutId = undefined;
        }
        this.setDragState(DragState.Dragging);
      }, 0);
    } else {
      if (this.notDraggingTimeoutId) {
        window.clearTimeout(this.notDraggingTimeoutId);
      }
      this.notDraggingTimeoutId = window.setTimeout(() => this.setDragState(DragState.None), 100);
    }
  }
}
