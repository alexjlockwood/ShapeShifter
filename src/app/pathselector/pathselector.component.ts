import {
  Component, ElementRef, ChangeDetectionStrategy,
  Pipe, PipeTransform
} from '@angular/core';
import { CanvasType } from '../CanvasType';
import { StateService, } from '../services';
import { SvgLoader } from '../scripts/import';
import { VectorLayer, PathLayer } from '../scripts/layers';
import { Observable } from 'rxjs/Observable';

declare const ga: Function;

@Component({
  selector: 'app-pathselector',
  templateUrl: './pathselector.component.html',
  styleUrls: ['./pathselector.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PathSelectorComponent {
  CANVAS_START = CanvasType.Start;
  CANVAS_END = CanvasType.End;

  // These are public because they are accessed via the HTML template.
  readonly startVectorLayerObservable: Observable<VectorLayer>;
  readonly endVectorLayerObservable: Observable<VectorLayer>;

  constructor(
    private readonly elementRef: ElementRef,
    private readonly stateService: StateService,
  ) {
    this.startVectorLayerObservable =
      this.stateService.getVectorLayerObservable(CanvasType.Start);
    this.endVectorLayerObservable =
      this.stateService.getVectorLayerObservable(CanvasType.End);
  }

  private setVectorLayer(canvasType: CanvasType, vectorLayer: VectorLayer) {
    const canvasTypes = [canvasType];
    if (canvasType === CanvasType.Start) {
      // The preview vector layer will be identical to both the start and end
      // vector layers in terms of their structure. During the animation, its
      // active path command will be interpolated and replaced to trigger the
      // animated result.
      this.stateService.setVectorLayer(CanvasType.Preview, vectorLayer.clone(), false);
      canvasTypes.push(CanvasType.Preview);
    }
    this.stateService.setVectorLayer(canvasType, vectorLayer, false);
    const pathLayers = getPathLayerList(this.stateService.getVectorLayer(canvasType));
    if (pathLayers.length) {
      // Auto-select the first path.
      this.setActivePathId(canvasType, pathLayers[0].id);
    }
    canvasTypes.forEach(type => this.stateService.notifyChange(type));
  }

  getActivePathId(canvasType: CanvasType) {
    return this.stateService.getActivePathId(canvasType);
  }

  setActivePathId(canvasType: CanvasType, activePathId: string) {
    // Always notify the preview layer in case the morphability status changed.
    const ids = [{ type: canvasType, pathId: activePathId }];
    if (canvasType === CanvasType.Start) {
      // Set the preview layer id before the start/end layer id to ensure
      // that auto-conversion runs properly.
      ids.unshift({ type: CanvasType.Preview, pathId: activePathId });
    }
    this.stateService.setActivePathIds(ids);
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
      if (!getPathLayerList(this.stateService.getVectorLayer(canvasTypes[i])).length) {
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
        SvgLoader.loadVectorLayerFromSvgStringWithCallback(svgText, vectorLayer => {
          this.setVectorLayer(canvasType, vectorLayer);
        });
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
    });
  }
}

@Pipe({ name: 'toPathLayerList' })
export class PathLayerListPipe implements PipeTransform {
  constructor(private stateService: StateService) { }

  transform(vectorLayer: VectorLayer | undefined): PathLayer[] {
    return getPathLayerList(vectorLayer);
  }
}

function getPathLayerList(vectorLayer: VectorLayer | undefined) {
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
