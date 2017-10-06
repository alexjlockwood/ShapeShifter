import 'rxjs/add/operator/first';

import { Injectable } from '@angular/core';
import { LayerUtil, VectorLayer } from 'app/model/layers';
import { Animation } from 'app/model/timeline';
import { ModelUtil } from 'app/scripts/common';
import { SvgLoader, VectorDrawableLoader } from 'app/scripts/import';
import { AnimatorService } from 'app/services/animator.service';
import { FileExportService } from 'app/services/fileexport.service';
import { LayerTimelineService } from 'app/services/layertimeline.service';
import { Duration, SnackBarService } from 'app/services/snackbar.service';
import { State, Store } from 'app/store';
import { getVectorLayer } from 'app/store/layers/selectors';
import { ResetWorkspace } from 'app/store/reset/actions';

declare const ga: Function;

enum ImportType {
  Svg = 1,
  VectorDrawable,
  Json,
}

/**
 * A simple service that imports vector layers from files.
 */
@Injectable()
export class FileImportService {
  constructor(
    private readonly store: Store<State>,
    private readonly snackBarService: SnackBarService,
    private readonly animatorService: AnimatorService,
    private readonly layerTimelineService: LayerTimelineService,
  ) {}

  private get vectorLayer() {
    let vectorLayer: VectorLayer;
    this.store
      .select(getVectorLayer)
      .first()
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
            console.error('Failed to parse the file', e);
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
      // TODO: avoid these hacks
      this.animatorService.reset();
      this.store.dispatch(new ResetWorkspace(vls[0], animation, hiddenLayerIds));
      this.animatorService.reset();
    } else {
      if (importType === ImportType.Svg) {
        ga('send', 'event', 'Import', 'SVG');
      } else if (importType === ImportType.VectorDrawable) {
        ga('send', 'event', 'Import', 'Vector Drawable');
      }
      if (resetWorkspace) {
        // TODO: avoid these hacks
        this.animatorService.reset();
        this.store.dispatch(new ResetWorkspace());
        this.animatorService.reset();
      }
      this.layerTimelineService.importLayers(vls);
      // TODO: count number of individual layers?
      this.snackBarService.show(
        `Imported ${vls.length} layers${vls.length === 1 ? '' : 's'}`,
        'Dismiss',
        Duration.Short,
      );
    }
  }

  private onFailure() {
    this.snackBarService.show(`Couldn't import layers from file.`, 'Dismiss', Duration.Long);
  }
}
