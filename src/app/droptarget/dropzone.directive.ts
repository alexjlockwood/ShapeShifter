import {
  Component, Input, Output, EventEmitter, HostListener, ElementRef, Directive
} from '@angular/core';

@Directive({ selector: '[appDropZone]' })
export class DropZoneDirective {
  @Output() fileOver: EventEmitter<any> = new EventEmitter();
  @Output() onFileDrop: EventEmitter<File[]> = new EventEmitter<File[]>();

  protected element: ElementRef;

  constructor(element: ElementRef) {
    this.element = element;
  }

  // public getOptions():any {
  //   return this.uploader.options;
  // }

  // public getFilters():any {
  //   return {};
  // }

  @HostListener('drop', ['$event'])
  onDrop(event: any): void {
    console.log('drop');
    // this._preventAndStop(event);
    // this.fileOver.emit(false);
    // this.onFileDrop.emit(transfer.files);
  }

  @HostListener('dragover', ['$event'])
  onDragOver(event: any): void {
    console.log('ondragover');
    // let transfer = this._getTransfer(event);
    // if (!this._haveFiles(transfer.types)) {
    //   return;
    // }

    // transfer.dropEffect = 'copy';
    // this._preventAndStop(event);
    // this.fileOver.emit(true);
  }

  @HostListener('dragleave', ['$event'])
  onDragLeave(event: any): any {
    console.log('ondragleave');
    // if ((this as any).element) {
    //   if (event.currentTarget === (this as any).element[0]) {
    //     return;
    //   }
    // }

    // this._preventAndStop(event);
    // this.fileOver.emit(false);
  }

  // protected _getTransfer(event: any): any {
  //   return event.dataTransfer ? event.dataTransfer : event.originalEvent.dataTransfer;
  // }

  // protected _preventAndStop(event: any): any {
  //   event.preventDefault();
  //   event.stopPropagation();
  // }

  // protected _haveFiles(types: any): any {
  //   if (!types) {
  //     return false;
  //   }

  //   if (types.indexOf) {
  //     return types.indexOf('Files') !== -1;
  //   } else if (types.contains) {
  //     return types.contains('Files');
  //   } else {
  //     return false;
  //   }
  // }

  /*
   _addOverClass(item:any):any {
   item.addOverClass();
   }
   _removeOverClass(item:any):any {
   item.removeOverClass();
   }*/
}
