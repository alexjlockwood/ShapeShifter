import { Component, OnInit, Input, OnDestroy } from '@angular/core';
import { CanvasType } from '../CanvasType';
import { LayerStateService } from '../services/layerstate.service';
import { VectorLayerLoader } from '../scripts/parsers';
import { Subscription } from 'rxjs/Subscription';
import { VectorLayer, PathLayer } from '../scripts/layers';

@Component({
  selector: 'app-pathselector',
  templateUrl: './pathselector.component.html',
  styleUrls: ['./pathselector.component.scss']
})
export class PathSelectorComponent {
  @Input() canvasType: CanvasType;

  private readonly subscriptions: Subscription[] = [];

  constructor(private layerStateService: LayerStateService) { }

  getVectorLayer() {
    return this.layerStateService.getVectorLayer(this.canvasType);
  }

  private setVectorLayer(vectorLayer: VectorLayer) {
    this.layerStateService.setVectorLayer(this.canvasType, vectorLayer);
    if (this.canvasType === CanvasType.Start) {
      // The preview vector layer will be identical to both the start and end
      // vector layers in terms of their structure. During the animation, its
      // active path command will be interpolated and replaced to create the
      // animated result.
      this.layerStateService.setVectorLayer(CanvasType.Preview, vectorLayer.clone());
    }
    const pathLayers = this.getPathLayers();
    if (pathLayers.length === 1) {
      // Auto select the first path if only one exists.
      this.setActivePathId(pathLayers[0].id);
    }
  }

  getPathLayers() {
    const vectorLayer = this.getVectorLayer();
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

  getActivePathId() {
    return this.layerStateService.getActivePathId(this.canvasType);
  }

  setActivePathId(activePathId: string) {
    this.layerStateService.setActivePathId(this.canvasType, activePathId);
    if (this.canvasType === CanvasType.Start) {
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

    const file = fileList[0];
    const fileReader = new FileReader();

    fileReader.onload = event => {
      const svgText = (event.target as any).result;
      this.setVectorLayer(VectorLayerLoader.loadVectorLayerFromSvgString(svgText));
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
