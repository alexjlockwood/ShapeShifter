import { Component, Input, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'app-dropsvg',
  templateUrl: './dropsvg.component.html',
  styleUrls: ['./dropsvg.component.scss']
})
export class DropSvgComponent {
  // @Input() private onSvgFileLoadedFunc: (fileName: string, fileType: string, svgText: string) => void;
  @Input() componentId: string;
  @Output() svgFileLoadedEmitter = new EventEmitter<string>();

  onLoadSvgFileComplete(fileList: FileList) {
    if (!fileList || !fileList.length) {
      console.warn('Failed to load SVG file');
      return;
    }

    const file = fileList[0];
    const fileReader = new FileReader();

    fileReader.onload = event => {
      this.svgFileLoadedEmitter.emit((event.target as any).result);
    };

    fileReader.onerror = event => {
      const target = event.target as any;
      switch (target.error.code) {
        case target.error.NOT_FOUND_ERR:
          alert('File not found!');
          break;
        case target.error.NOT_READABLE_ERR:
          alert('File is not readable');
          break;
        case target.error.ABORT_ERR:
          break; // noop
        default:
          alert('An error occurred reading this file.');
      }
    };

    fileReader.onabort = event => {
      alert('File read cancelled');
    };

    fileReader.readAsText(file);
  }
}
