import { Component, OnInit, Input, OnDestroy, ElementRef } from '@angular/core';
import { CanvasType } from '../CanvasType';
import { LayerStateService } from '../services/layerstate.service';
import { VectorLayerLoader } from '../scripts/parsers';
import { Subscription } from 'rxjs/Subscription';
import { VectorLayer, PathLayer } from '../scripts/layers';
import * as $ from 'jquery';

@Component({
  selector: 'app-pathselector',
  templateUrl: './pathselector.component.html',
  styleUrls: ['./pathselector.component.scss']
})
export class PathSelectorComponent {
  CANVAS_START = CanvasType.Start;
  CANVAS_END = CanvasType.End;

  private readonly subscriptions: Subscription[] = [];

  constructor(
    private elementRef: ElementRef,
    private layerStateService: LayerStateService) { }

  private setVectorLayer(canvasType: CanvasType, vectorLayer: VectorLayer) {
    this.layerStateService.setVectorLayer(canvasType, vectorLayer);
    if (canvasType === CanvasType.Start) {
      // The preview vector layer will be identical to both the start and end
      // vector layers in terms of their structure. During the animation, its
      // active path command will be interpolated and replaced to trigger the
      // animated result.
      this.layerStateService.setVectorLayer(CanvasType.Preview, vectorLayer.clone());
    }
    const pathLayers = this.getPathList(canvasType);
    if (pathLayers.length === 1) {
      // Auto-select the first path if only one exists.
      this.setActivePathId(canvasType, pathLayers[0].id);
    }
  }

  getPathList(canvasType: CanvasType) {
    const vectorLayer = this.layerStateService.getVectorLayer(canvasType);
    const pathLayers: PathLayer[] = [];
    if (vectorLayer) {
      vectorLayer.walk((layer => {
        if (layer instanceof PathLayer) {
          pathLayers.push(layer);
        }
      }));
    }
    return pathLayers;
  }

  getActivePathId(canvasType: CanvasType) {
    return this.layerStateService.getActivePathId(canvasType);
  }

  setActivePathId(canvasType: CanvasType, activePathId: string) {
    this.layerStateService.setActivePathId(canvasType, activePathId);
    if (canvasType === CanvasType.Start) {
      this.layerStateService.setActivePathId(CanvasType.Preview, activePathId);
    }
  }

  trackPathLayer(index: number, item: PathLayer) {
    return item.id;
  }

  // Called when the user picks a file from the file picker.
  onSvgFileChosen(fileList: FileList) {
    if (!fileList || !fileList.length) {
      console.warn('Failed to load SVG file');
      return;
    }

    const files: File[] = [];
    for (let i = 0; i < Math.min(2, fileList.length); i++) {
      files.push(fileList[i]);
    }

    const canvasTypes = [CanvasType.Start, CanvasType.End];
    const availableEmptyListSlots: CanvasType[] = [];
    for (let i = 0; i < canvasTypes.length; i++) {
      if (!this.getPathList(canvasTypes[i]).length) {
        availableEmptyListSlots.push(canvasTypes[i]);
      }
    }

    interface CanvasTypeToFile {
      canvasType: CanvasType;
      file: File;
    }
    const canvasTypesToFiles: CanvasTypeToFile[] = [];
    const numIterations =
      Math.min(files.length, availableEmptyListSlots.length);
    for (let i = 0; i < numIterations; i++) {
      canvasTypesToFiles.push({
        canvasType: availableEmptyListSlots[i],
        file: files[i],
      });
    }

    canvasTypesToFiles.forEach(obj => {
      const canvasType = obj.canvasType;
      const file = obj.file;
      const fileReader = new FileReader();

      fileReader.onload = event => {
        const svgText = (event.target as any).result;
        this.setVectorLayer(
          canvasType, VectorLayerLoader.loadVectorLayerFromSvgString(svgText));
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

      // Clear the value so that the user can import the same
      // file twice if they wish.
      $(this.elementRef).find('input[type="file"]').val(null);
    });
  }
}
