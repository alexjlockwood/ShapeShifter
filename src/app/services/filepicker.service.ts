import { Injectable } from '@angular/core';
import { Subject } from 'rxjs/Subject';
import { CanvasType } from '../CanvasType';

/**
 * A simple service that broadcasts signals to open a file picker and begin
 * a SVG import.
 */
@Injectable()
export class FilePickerService {
  private readonly source = new Subject<CanvasType>();

  asObservable() {
    return this.source.asObservable();
  }

  showFilePicker(canvasType: CanvasType) {
    this.source.next(canvasType);
  }
}
