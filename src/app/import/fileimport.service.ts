import {
  LayerUtil,
  VectorLayer,
} from '../scripts/layers';
import { Animation } from '../scripts/timeline';
import {
  State,
  Store,
} from '../store';
import { getVectorLayer } from '../store/layers/selectors';
import * as  SvgLoader from './SvgLoader';
import * as VectorDrawableLoader from './VectorDrawableLoader';
import { Injectable } from '@angular/core';

/**
 * A simple service that imports vector layers from files.
 */
@Injectable()
export class FileImportService {
  private vectorLayer: VectorLayer;

  constructor(readonly store: Store<State>) {
    this.store.select(getVectorLayer).subscribe(vl => this.vectorLayer = vl);
  }

  import(
    fileList: FileList,
    successFn: (vls: VectorLayer[], animations?: Animation[]) => void,
    failureFn: () => void,
  ) {
    if (!fileList || !fileList.length) {
      return;
    }

    const files: File[] = [];
    // tslint:disable-next-line
    for (let i = 0; i < fileList.length; i++) {
      files.push(fileList[i]);
    }

    let numCallbacks = 0;
    let numErrors = 0;
    const addedVls: VectorLayer[] = [];

    const maybeAddVectorLayersFn = () => {
      numCallbacks++;
      if (numErrors === files.length) {
        failureFn();
      } else if (numCallbacks === files.length) {
        successFn(addedVls)
      }
    };

    const existingVl = this.vectorLayer;
    for (const file of files) {
      const fileReader = new FileReader();

      fileReader.onload = event => {
        const text = (event.target as any).result;
        const callbackFn =
          vectorLayer => {
            if (!vectorLayer) {
              numErrors++;
              maybeAddVectorLayersFn();
              return;
            }
            addedVls.push(vectorLayer);
            maybeAddVectorLayersFn();
          };
        const doesNameExistFn =
          (name: string) => {
            return !!LayerUtil.findLayerByName([existingVl, ...addedVls], name);
          };
        if (file.type.includes('svg')) {
          SvgLoader.loadVectorLayerFromSvgStringWithCallback(text, callbackFn, doesNameExistFn);
        } else if (file.type.includes('xml')) {
          let vl: VectorLayer;
          try {
            vl = VectorDrawableLoader.loadVectorLayerFromXmlString(text, doesNameExistFn);
          } catch (e) {
            console.error('Failed to parse the file', e);
            callbackFn(undefined);
          }
          callbackFn(vl);
        } else if (file.type === 'application/json' || file.name.match(/\.shapeshifter$/)) {
          let vl: VectorLayer;
          let animations: Animation[];
          try {
            const jsonObj = JSON.parse(text);
            vl = new VectorLayer(jsonObj.vectorLayer);
            animations = jsonObj.animations.map(anim => new Animation(anim));
          } catch (e) {
            console.error('Failed to parse the file', e);
            failureFn();
          }
          successFn([vl], animations);
        }
      };

      fileReader.onerror = event => {
        const target = event.target as any;
        switch (target.error.code) {
          case target.error.NOT_FOUND_ERR:
            alert('File not found');
            break;
          case target.error.NOT_READABLE_ERR:
            alert('File is not readable');
            break;
          case target.error.ABORT_ERR:
            break;
          default:
            alert('An error occurred reading this file');
        }
        numErrors++;
        maybeAddVectorLayersFn();
      };

      fileReader.onabort = event => {
        alert('File read cancelled');
      };

      fileReader.readAsText(file);
    }
  }
}
