import {
  Component, ChangeDetectionStrategy, OnInit
} from '@angular/core';
import { CanvasType } from '../CanvasType';
import { StateService, } from '../services';
import { SvgLoader } from '../scripts/import';
import { VectorLayer } from '../scripts/layers';
import { Observable } from 'rxjs/Observable';

declare const ga: Function;

@Component({
  selector: 'app-pathselector',
  templateUrl: './pathselector.component.html',
  styleUrls: ['./pathselector.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PathSelectorComponent implements OnInit {
  CANVAS_START = CanvasType.Start;
  CANVAS_END = CanvasType.End;

  // These are public because they are accessed via the HTML template.
  existingPathIdsObservable: Observable<ReadonlyArray<string>>;
  startActivePathIdObservable: Observable<string>;
  endActivePathIdObservable: Observable<string>;

  constructor(private readonly stateService: StateService) { }

  ngOnInit() {
    this.existingPathIdsObservable =
      this.stateService.getExistingPathIdsObservable();
    this.startActivePathIdObservable =
      this.stateService.getActivePathIdObservable(CanvasType.Start);
    this.endActivePathIdObservable =
      this.stateService.getActivePathIdObservable(CanvasType.End);
  }

  // private addVectorLayer(vectorLayer: VectorLayer) {
  //   const canvasTypes = [canvasType];
  //   if (canvasType === CanvasType.Start) {
  //     // The preview vector layer will be identical to both the start and end
  //     // vector layers in terms of their structure. During the animation, its
  //     // active path command will be interpolated and replaced to trigger the
  //     // animated result.
  //     this.stateService.setVectorLayer(CanvasType.Preview, vectorLayer.clone(), false);
  //     canvasTypes.push(CanvasType.Preview);
  //   }
  //   this.stateService.setVectorLayer(canvasType, vectorLayer, false);
  //   const pathLayers = getPathLayerList(this.stateService.getVectorLayer(canvasType));
  //   //if (pathLayers.length) {
  //   // TODO: Auto-select the first path.
  //   //this.setActivePathId(canvasType, pathLayers[0].id);
  //   //}
  //   canvasTypes.forEach(type => this.stateService.notifyChange(type));
  // }

  getActivePathId(canvasType: CanvasType) {
    return this.stateService.getActivePathId(canvasType);
  }

  setStartActivePathId(activePathId: string) {
    // Always notify the preview layer in case the morphability status changed.
    const ids = [{ type: CanvasType.Start, pathId: activePathId }];
    // Set the preview layer id before the start/end layer id to ensure
    // that auto-conversion runs properly.
    ids.unshift({ type: CanvasType.Preview, pathId: activePathId });
    console.info(ids);
    console.info(this.stateService);
    this.stateService.setActivePathIds(ids);
  }

  setEndActivePathId(activePathId: string) {
    // Always notify the preview layer in case the morphability status changed.
    const ids = [{ type: CanvasType.End, pathId: activePathId }];
    console.info(ids);
    console.info(this.stateService);
    this.stateService.setActivePathIds(ids);
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

    const vectorLayers: VectorLayer[] = [];
    for (const file of files) {
      const fileReader = new FileReader();

      fileReader.onload = event => {
        const svgText = (event.target as any).result;
        SvgLoader.loadVectorLayerFromSvgStringWithCallback(svgText, vectorLayer => {
          vectorLayers.push(vectorLayer);
          if (vectorLayers.length === files.length) {
            // TODO: what if an error happens? import the vector layers that succeeded?
            this.stateService.addVectorLayers(vectorLayers);
          }
        }, this.stateService.getExistingPathIds());
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
}
