import { environment } from '../../environments/environment';
import { Component, OnInit, Input, OnDestroy } from '@angular/core';
import { CanvasType } from '../CanvasType';
import { LayerStateService } from '../services/layerstate.service';
import { VectorLayerLoader } from '../scripts/parsers';
import { Subscription } from 'rxjs/Subscription';
import { VectorLayer, PathLayer } from '../scripts/layers';

const IS_DEV_MODE = !environment.production;

@Component({
  selector: 'app-pathselector',
  templateUrl: './pathselector.component.html',
  styleUrls: ['./pathselector.component.scss']
})
export class PathSelectorComponent {
  @Input() canvasType: CanvasType;

  private pathLayers_: PathLayer[];
  private readonly subscriptions: Subscription[] = [];

  constructor(private layerStateService: LayerStateService) { }

  get vectorLayer() {
    return this.layerStateService.getVectorLayer(this.canvasType);
  }

  set vectorLayer(vectorLayer: VectorLayer) {
    this.layerStateService.setVectorLayer(this.canvasType, vectorLayer);
    const pathLayers = this.pathLayers;
    if (pathLayers.length === 1) {
      this.layerStateService.setActivePathId(this.canvasType, pathLayers[0].id);
    }
  }

  get pathLayers() {
    const vectorLayer = this.vectorLayer;
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

  get activePathId() {
    return this.layerStateService.getActivePathId(this.canvasType);
  }

  set activePathId(activePathId: string) {
    this.layerStateService.setActivePathId(this.canvasType, activePathId);
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
      this.vectorLayer = VectorLayerLoader.loadVectorLayerFromSvgString(svgText);
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
