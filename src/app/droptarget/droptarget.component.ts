import {
  Component, Input,
  OnInit, ElementRef, ViewChild, OnDestroy
} from '@angular/core';
import { LayerStateService } from '../services/layerstate.service';
import { EditorType } from '../EditorType';
import * as $ from 'jquery';
import { VectorLayerLoader } from '../scripts/parsers';
import { CanvasResizeService } from '../services/canvasresize.service';
import { Subscription } from 'rxjs/Subscription';

// Drop target margin in pixels.
const DROP_TARGET_MARGIN = 36;

@Component({
  selector: 'app-droptarget',
  templateUrl: './droptarget.component.html',
  styleUrls: ['./droptarget.component.scss']
})
export class DropTargetComponent implements OnInit, OnDestroy {
  @Input() editorType: EditorType;
  @ViewChild('fileDropTarget') private fileDropTargetRef: ElementRef;

  private element: JQuery;
  private fileDropTarget: JQuery;
  private fileInputTarget: JQuery;
  private componentSize = 0;
  private subscriptions: Subscription[] = [];

  constructor(
    private elementRef: ElementRef,
    private canvasResizeService: CanvasResizeService,
    private layerStateService: LayerStateService) { }

  ngOnInit() {
    this.element = $(this.elementRef.nativeElement);
    this.fileDropTarget = $(this.fileDropTargetRef.nativeElement);
    this.fileInputTarget = this.element.find('input');
    this.canvasResizeService.addListener(size => {
      const width = size.width - DROP_TARGET_MARGIN * 2;
      const height = size.height - DROP_TARGET_MARGIN * 2;
      const containerSize = Math.min(width, height);
      if (this.componentSize !== containerSize) {
        this.componentSize = containerSize;
        this.resize();
      }
    });
    this.resize();
  }

  ngOnDestroy() {
    this.subscriptions.forEach(s => s.unsubscribe);
  }

  private resize() {
    const containerWidth = Math.max(1, this.componentSize);
    const containerHeight = Math.max(1, this.componentSize);
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
      const vectorLayer = VectorLayerLoader.loadVectorLayerFromSvgString(svgText);
      this.layerStateService.setLayer(this.editorType, vectorLayer);
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
