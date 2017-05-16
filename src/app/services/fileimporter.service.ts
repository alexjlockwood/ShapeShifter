import { Injectable } from '@angular/core';
import { Store, State, getVectorLayers } from '../store';
import { VectorLayer, LayerUtil } from '../scripts/layers';
import { SvgLoader, VectorDrawableLoader } from '../scripts/import';

/**
 * A simple service that imports vector layers from files.
 */
@Injectable()
export class FileImporterService {
  private vectorLayers: ReadonlyArray<VectorLayer>;

  constructor(private readonly store: Store<State>) {
    this.store.select(getVectorLayers).subscribe(vls => this.vectorLayers = vls);
  }

  import(
    fileList: FileList,
    successCallbackFn: (vls: VectorLayer[]) => void,
    failureCallbackFn: () => void,
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
        failureCallbackFn();
      } else if (numCallbacks === files.length) {
        successCallbackFn(addedVls)
      }
    };

    const existingVls = this.vectorLayers.slice();
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
            return !!LayerUtil.findLayerByName(existingVls.concat(addedVls), name);
          };
        if (file.type.includes('svg')) {
          SvgLoader.loadVectorLayerFromSvgStringWithCallback(text, callbackFn, doesNameExistFn);
        } else if (file.type.includes('xml')) {
          try {
            const vl = VectorDrawableLoader.loadVectorLayerFromXmlString(text, doesNameExistFn);
            callbackFn(vl);
          } catch (e) {
            console.error('Failed to parse the XML file', e);
            callbackFn(undefined);
          }
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
