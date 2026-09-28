import type { Guide } from 'app/modules/editor/model/guides';
import { LayerUtil, VectorLayer } from 'app/modules/editor/model/layers';
import { NEWER_VERSION_WARNING, ProjectFormatError } from 'app/modules/editor/model/projectVersion';
import { Animation } from 'app/modules/editor/model/timeline';
import { trackEvent } from 'app/modules/editor/scripts/analytics';
import * as ModelUtil from 'app/modules/editor/scripts/common/ModelUtil';
import { SvgLoader, VectorDrawableLoader } from 'app/modules/editor/scripts/import';
import { State, Store } from 'app/modules/editor/store';
import { getVectorLayer } from 'app/modules/editor/store/layers/selectors';
import { ResetWorkspace } from 'app/modules/editor/store/reset/actions';

import { ActionModeService } from './actionmode.service';
import { FileExportService } from './fileexport.service';
import { LayerTimelineService } from './layertimeline.service';
import { Duration, SnackBarService } from './snackbar.service';

enum ImportType {
  Svg = 1,
  VectorDrawable,
  Json,
}

/**
 * A simple service that imports vector layers from files.
 */
export class FileImportService {
  constructor(
    private readonly store: Store<State>,
    private readonly snackBarService: SnackBarService,
    private readonly layerTimelineService: LayerTimelineService,
    private readonly actionModeService: ActionModeService,
  ) {}

  // Kept so that it isn't garbage collected before the picker reports the files.
  private fileInput: HTMLInputElement | undefined;

  private get vectorLayer() {
    return getVectorLayer(this.store.getState());
  }

  /**
   * Opens a file picker for SVGs or Vector Drawables, and imports the files picked. It has to be
   * called while handling a click, or the browser won't open the picker.
   */
  pickFilesToImport(type: 'svg' | 'vectorDrawable') {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = type === 'svg' ? '.svg' : '.xml';
    input.multiple = true;
    input.addEventListener('change', () => {
      if (input.files) {
        this.import(input.files);
      }
      this.fileInput = undefined;
    });
    this.fileInput = input;
    input.click();
  }

  import(fileList: FileList, resetWorkspace = false) {
    if (!fileList || !fileList.length) {
      return;
    }

    const files: File[] = [];
    for (let i = 0; i < fileList.length; i++) {
      files.push(fileList[i]);
    }

    let numCallbacks = 0;
    let numErrors = 0;
    // The files load in any order, so each one's layers are kept at its index, which says which
    // file a morph goes from and which it goes to (onLayersLoaded).
    const loadedVls: Array<VectorLayer | undefined> = files.map(() => undefined);
    const addedVls: VectorLayer[] = [];

    let importType: ImportType;
    const maybeAddVectorLayersFn = () => {
      numCallbacks++;
      if (numErrors === files.length) {
        this.onFailure();
      } else if (numCallbacks === files.length) {
        const loaded = files.flatMap((file, i) => {
          const vl = loadedVls[i];
          return vl ? [{ vl, name: file.name }] : [];
        });
        this.onLayersLoaded(
          importType,
          resetWorkspace,
          loaded.map(l => l.vl),
          loaded.map(l => l.name),
        );
      }
    };

    const existingVl = this.vectorLayer;
    for (const [fileIndex, file] of files.entries()) {
      // FileReader is missing in some locked-down browsers, and reading can throw synchronously
      // (e.g. a dropped folder in older Firefox versions).
      let fileReader: FileReader;
      try {
        fileReader = new FileReader();
      } catch (e) {
        console.warn('Failed to read the file', e);
        numErrors++;
        maybeAddVectorLayersFn();
        continue;
      }

      fileReader.onload = event => {
        const text = (event.target as any).result;
        const callbackFn = (vectorLayer: VectorLayer | undefined) => {
          if (!vectorLayer) {
            numErrors++;
            maybeAddVectorLayersFn();
            return;
          }
          loadedVls[fileIndex] = vectorLayer;
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
          try {
            callbackFn(VectorDrawableLoader.loadVectorLayerFromXmlString(text, doesNameExistFn));
          } catch (e) {
            console.warn('Failed to parse the file', e);
            callbackFn(undefined);
          }
        } else if (file.type === 'application/json' || file.name.match(/\.shapeshifter$/)) {
          importType = ImportType.Json;
          let vl: VectorLayer;
          let animation: Animation;
          let hiddenLayerIds: ReadonlySet<string>;
          let guides: ReadonlyArray<Guide>;
          let newerVersion: boolean;
          try {
            const jsonObj = JSON.parse(text);
            const parsedObj = FileExportService.fromJSON(jsonObj);
            vl = parsedObj.vectorLayer;
            animation = parsedObj.animation;
            hiddenLayerIds = parsedObj.hiddenLayerIds;
            guides = parsedObj.guides;
            newerVersion = parsedObj.newerVersion;
            const regeneratedModels = ModelUtil.regenerateModelIds(vl, animation, hiddenLayerIds);
            vl = regeneratedModels.vectorLayer;
            animation = regeneratedModels.animation;
            hiddenLayerIds = regeneratedModels.hiddenLayerIds;
          } catch (e) {
            console.warn('Failed to parse the file', e);
            this.onFailure(e instanceof ProjectFormatError ? e.message : undefined);
            return;
          }
          this.onProjectLoaded(vl, animation, hiddenLayerIds, guides, newerVersion);
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

      try {
        fileReader.readAsText(file);
      } catch (e) {
        console.warn('Failed to read the file', e);
        numErrors++;
        maybeAddVectorLayersFn();
      }
    }
  }

  private onProjectLoaded(
    vl: VectorLayer,
    animation: Animation,
    hiddenLayerIds: ReadonlySet<string>,
    guides: ReadonlyArray<Guide>,
    newerVersion: boolean,
  ) {
    trackEvent('import_shapeshifter');
    this.store.dispatch(new ResetWorkspace(vl, animation, hiddenLayerIds, guides));
    if (newerVersion) {
      this.snackBarService.show(NEWER_VERSION_WARNING, 'Dismiss', Duration.Long);
    }
  }

  /**
   * Adds the layers of SVG and VectorDrawable files, and offers to morph them if that would work
   * (ActionModeService.offerImportMorph), or says how many it imported.
   */
  private onLayersLoaded(
    importType: ImportType,
    resetWorkspace: boolean,
    vls: ReadonlyArray<VectorLayer>,
    fileNames: ReadonlyArray<string>,
  ) {
    if (importType === ImportType.Svg) {
      trackEvent('import_svg');
    } else if (importType === ImportType.VectorDrawable) {
      trackEvent('import_vector_drawable');
    }
    if (resetWorkspace) {
      this.store.dispatch(new ResetWorkspace());
    }
    const before = this.layerTimelineService.getVectorLayer();
    const importedIds = this.layerTimelineService.importLayers(vls);
    if (this.actionModeService.offerImportMorph(before, importedIds, fileNames)) {
      return;
    }
    // TODO: count number of individual layers?
    this.snackBarService.show(
      `Imported ${vls.length} layer${vls.length === 1 ? '' : 's'}`,
      'Dismiss',
      Duration.Short,
    );
  }

  private onFailure(message = `Couldn't import layers from file`) {
    this.snackBarService.show(message, 'Dismiss', Duration.Long);
  }
}
