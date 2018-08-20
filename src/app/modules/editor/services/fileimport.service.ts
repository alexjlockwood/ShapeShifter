import { Injectable } from '@angular/core';
import { LayerUtil, VectorLayer } from 'app/modules/editor/model/layers';
import { Animation } from 'app/modules/editor/model/timeline';
import { ModelUtil } from 'app/modules/editor/scripts/common';
import { SvgLoader, VectorDrawableLoader } from 'app/modules/editor/scripts/import';
import { State, Store } from 'app/modules/editor/store';
import { getVectorLayer } from 'app/modules/editor/store/layers/selectors';
import { ResetWorkspace } from 'app/modules/editor/store/reset/actions';
import { first } from 'rxjs/operators';

import { FileExportService } from './fileexport.service';
import { LayerTimelineService } from './layertimeline.service';
import { Duration, SnackBarService } from './snackbar.service';

declare const ga: Function;

enum ImportType {
  Svg = 1,
  VectorDrawable,
  Json,
}

/**
 * A simple service that imports vector layers from files.
 */
@Injectable({ providedIn: 'root' })
export class FileImportService {
  constructor(
    private readonly store: Store<State>,
    private readonly snackBarService: SnackBarService,
    private readonly layerTimelineService: LayerTimelineService,
  ) {}

  private get vectorLayer() {
    let vectorLayer: VectorLayer;
    this.store
      .select(getVectorLayer)
      .pipe(first())
      .subscribe(vl => (vectorLayer = vl));
    return vectorLayer;
  }

  import(fileList: FileList, resetWorkspace = false) {
    if (!fileList || !fileList.length) {
      return;
    }

    const files: File[] = [];
    // tslint:disable-next-line: prefer-for-of
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
        this.onFailure();
      } else if (numCallbacks === files.length) {
        this.onSuccess(importType, resetWorkspace, addedVls);
      }
    };

    const existingVl = this.vectorLayer;
    for (const file of files) {
      const fileReader = new FileReader();

      fileReader.onload = event => {
        const text = (event.target as any).result;
        const callbackFn = (vectorLayer: VectorLayer) => {
          if (!vectorLayer) {
            numErrors++;
            maybeAddVectorLayersFn();
            return;
          }
          addedVls.push(vectorLayer);
          maybeAddVectorLayersFn();
        };
        const doesNameExistFn = (name: string) => {
          return !!LayerUtil.findLayerByName([existingVl, ...addedVls], name);
        };
        if (file.type.includes('svg')) {
          importType = ImportType.Svg;
          SvgLoader.loadVectorLayerFromSvgString(text, doesNameExistFn)
            .then(vl => callbackFn(vl))
            .catch(() => {
              console.warn('failed to import SVG');
              callbackFn(undefined);
            });
        } else if (file.type.includes('xml')) {
          importType = ImportType.VectorDrawable;
          let vl: VectorLayer;
          try {
            vl = VectorDrawableLoader.loadVectorLayerFromXmlString(text, doesNameExistFn);
            callbackFn(vl);
          } catch (e) {
            console.warn('Failed to parse the file', e);
            callbackFn(undefined);
          }
        } else if (file.type === 'application/json' || file.name.match(/\.shapeshifter$/)) {
          importType = ImportType.Json;
          let vl: VectorLayer;
          let animation: Animation;
          let hiddenLayerIds: ReadonlySet<string>;
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
            console.warn('Failed to parse the file', e);
            this.onFailure();
          }
          this.onSuccess(importType, resetWorkspace, [vl], animation, hiddenLayerIds);
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
            break;
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

  private onSuccess(
    importType: ImportType,
    resetWorkspace: boolean,
    vls: ReadonlyArray<VectorLayer>,
    animation?: Animation,
    hiddenLayerIds?: ReadonlySet<string>,
  ) {
    if (importType === ImportType.Json) {
      ga('send', 'event', 'Import', 'JSON');
      this.store.dispatch(new ResetWorkspace(vls[0], animation, hiddenLayerIds));
    } else {
      if (importType === ImportType.Svg) {
        ga('send', 'event', 'Import', 'SVG');
      } else if (importType === ImportType.VectorDrawable) {
        ga('send', 'event', 'Import', 'Vector Drawable');
      }
      if (resetWorkspace) {
        this.store.dispatch(new ResetWorkspace());
      }
      this.layerTimelineService.importLayers(vls);
      // TODO: count number of individual layers?
      this.snackBarService.show(
        `Imported ${vls.length} layer${vls.length === 1 ? '' : 's'}`,
        'Dismiss',
        Duration.Short,
      );
    }
  }

  private onFailure() {
    this.snackBarService.show(`Couldn't import layers from file`, 'Dismiss', Duration.Long);
  }
}
