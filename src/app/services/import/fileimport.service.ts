import { Injectable } from '@angular/core';
import { ModelUtil } from 'app/scripts/common';
import {
  SvgLoader,
  VectorDrawableLoader,
} from 'app/scripts/import';
import {
  LayerUtil,
  VectorLayer,
} from 'app/scripts/model/layers';
import { Animation } from 'app/scripts/model/timeline';
import { FileExportService } from 'app/services/export/fileexport.service';
import {
  State,
  Store,
} from 'app/store';
import { getVectorLayer } from 'app/store/layers/selectors';

export enum ImportType {
  Svg = 1,
  VectorDrawable,
  Json,
}

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
    successFn: (type: ImportType, vls: VectorLayer[], animation?: Animation, hiddenLayerIds?: Set<string>) => void,
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

    let importType: ImportType;
    const maybeAddVectorLayersFn = () => {
      numCallbacks++;
      if (numErrors === files.length) {
        failureFn();
      } else if (numCallbacks === files.length) {
        successFn(importType, addedVls);
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
          importType = ImportType.Svg;
          SvgLoader.loadVectorLayerFromSvgStringWithCallback(text, callbackFn, doesNameExistFn);
        } else if (file.type.includes('xml')) {
          importType = ImportType.VectorDrawable;
          let vl: VectorLayer;
          try {
            vl = VectorDrawableLoader.loadVectorLayerFromXmlString(text, doesNameExistFn);
          } catch (e) {
            console.error('Failed to parse the file', e);
            callbackFn(undefined);
          }
          callbackFn(vl);
        } else if (file.type === 'application/json' || file.name.match(/\.shapeshifter$/)) {
          importType = ImportType.Json;
          let vl: VectorLayer;
          let animation: Animation;
          let hiddenLayerIds: Set<string>;
          try {
            const jsonObj = JSON.parse(text);
            const parsedObj = FileExportService.fromJSON(jsonObj);
            vl = parsedObj.vectorLayer;
            animation = parsedObj.animation;
            hiddenLayerIds = parsedObj.hiddenLayerIds;
            const regeneratedModels = ModelUtil.regenerateModelIds(vl, animation, hiddenLayerIds);
            vl = regeneratedModels.vectorLayer;
            animation = regeneratedModels.animation;
            hiddenLayerIds = regeneratedModels.hiddenLayerIds;
          } catch (e) {
            console.error('Failed to parse the file', e);
            failureFn();
          }
          successFn(importType, [vl], animation, hiddenLayerIds);
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
