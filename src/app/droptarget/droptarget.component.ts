import {
  Component, Input,
  OnInit, ElementRef, ViewChild, OnDestroy
} from '@angular/core';
import { LayerStateService } from '../services/layerstate.service';
import { EditorType } from '../scripts/model';
import * as $ from 'jquery';
import * as erd from 'element-resize-detector';
import { SvgLoader } from '../scripts/svg';

const ELEMENT_RESIZE_DETECTOR = erd();

@Component({
  selector: 'app-droptarget',
  templateUrl: './droptarget.component.html',
  styleUrls: ['./droptarget.component.scss']
})
export class DropTargetComponent implements OnInit, OnDestroy {
  @Input() editorType: EditorType;
  @ViewChild('fileDropTarget') private fileDropTargetRef: ElementRef;

  private fileDropTarget: JQuery;
  private fileInputTarget: JQuery;
  private containerSize: number;

  constructor(
    private elementRef: ElementRef,
    private layerStateService: LayerStateService) { }

  ngOnInit() {
    const element = $(this.elementRef.nativeElement);
    this.fileDropTarget = $(this.fileDropTargetRef.nativeElement);
    this.fileInputTarget = element.find('input');
    this.containerSize = element.width();
    ELEMENT_RESIZE_DETECTOR.listenTo(this.elementRef.nativeElement, el => {
      const containerSize = element.width();
      if (this.containerSize !== containerSize) {
        this.containerSize = containerSize;
        this.resize();
      }
    });
    this.resize();
  }

  ngOnDestroy() {
    ELEMENT_RESIZE_DETECTOR.removeAllListeners(this.elementRef.nativeElement);
  }

  private resize() {
    const containerWidth = Math.max(1, this.containerSize);
    const containerHeight = Math.max(1, this.containerSize);
    this.fileDropTarget.width(containerWidth).height(containerHeight);
    this.fileInputTarget.width(containerWidth).height(containerHeight);
  }

  // Called when the user picks a file from the file picker.
  onSvgFileChosen(fileList: FileList) {
    if (!fileList || !fileList.length) {
      console.warn('Failed to load SVG file');
      return;
    }

    const file = fileList[0];
    const fileReader = new FileReader();

    fileReader.onload = event => {
      const svgText = (event.target as any).result;
      const vectorLayer = SvgLoader.loadVectorLayerFromSvgString(svgText);
      this.layerStateService.setData(this.editorType, vectorLayer);
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
          break;
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
