import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';
import { Layer, VectorLayer, PathLayer, GroupLayer, LayerUtil } from '../scripts/layers';
import { CanvasType } from '../CanvasType';
import { Path } from '../scripts/paths';
import { AutoAwesome } from '../scripts/autoawesome';
import { ROTATION_GROUP_LAYER_ID } from '../scripts/import';

// Note that importing these from '.' causes runtime errors.
import { AppModeService } from './appmode.service';
import { AnimatorService } from './animator.service';
import { HoverService } from './hover.service';
import { SelectionService } from './selection.service';

/**
 * The global state service that is in charge of keeping track of the loaded
 * SVGs, active path layers, and the current morphability status.
 */
@Injectable()
export class StateService {
  // Maps path IDs to their parent VectorLayers.
  private readonly importedPathMap = new Map<string, VectorLayer>();
  // Observable that broadcasts changes to the current list of imported path IDs.
  private readonly existingPathIdsSource = new BehaviorSubject<ReadonlyArray<string>>([]);
  // Maps CanvasTypes to the currently active path ID.
  private readonly activePathIdMap = new Map<CanvasType, string>();
  // Maps CanvasTypes to a copy of the active path ID's parent VectorLayer.
  private readonly activeLayerMap = new Map<CanvasType, VectorLayer>();
  // Observable that broadcasts changes to the currently active path ID for each CanvasType.
  private readonly activePathIdSources = new Map<CanvasType, BehaviorSubject<string>>();
  // Observable that broadcast changes to the current morphability status.
  private readonly statusSource = new BehaviorSubject<MorphabilityStatus>(MorphabilityStatus.None);
  // Set that keeps track our list of deleted path IDs.
  private readonly deletedPathIds = new Set<string>();

  constructor(
    private readonly selectionService: SelectionService,
    private readonly hoverService: HoverService,
    private readonly animatorService: AnimatorService,
    private readonly appModeService: AppModeService,
  ) {
    [CanvasType.Start, CanvasType.Preview, CanvasType.End]
      .forEach(type => {
        this.activePathIdSources.set(type, new BehaviorSubject<string>(undefined));
      });
  }

  /**
   * Imports all paths in the given VectorLayers into the application's state.
   */
  addVectorLayers(vectorLayers: VectorLayer[], clearExistingState = false) {
    if (clearExistingState) {
      this.reset();
    }
    for (const vl of vectorLayers) {
      const pathMap = this.importedPathMap;
      (function recurseFn(layer: Layer) {
        if (layer instanceof PathLayer) {
          if (pathMap.has(layer.id)) {
            console.warn('Ignoring attempt to add duplicate path ID', pathMap, vl, layer.id);
            return;
          }
          // TODO: is it necessary to clone here? just to be safe?
          pathMap.set(layer.id, vl.clone());
          return;
        }
        if (layer.children) {
          layer.children.forEach(l => recurseFn(l));
        }
      })(vl);
    }
    this.existingPathIdsSource.next(Array.from(this.importedPathMap.keys()));
  }

  /**
   * Returns the currently set vector layer for the specified canvas type.
   */
  getVectorLayer(canvasType: CanvasType) {
    return this.activeLayerMap.get(canvasType);
  }

  /**
   * Returns the currently set active path ID for the specified canvas type.
   */
  getActivePathId(type: CanvasType): string | undefined {
    return this.activePathIdMap.get(type);
  }

  /**
   * Called by the PathSelectorComponent when a new vector layer path is selected.
   */
  setActivePathId(canvasType: CanvasType, pathId: string, shouldNotify = true) {
    if (this.getActivePathId(canvasType) === pathId) {
      if (shouldNotify) {
        this.notifyChange(canvasType);
      }
      return;
    }
    this.appModeService.reset();
    this.selectionService.reset();
    this.hoverService.reset();

    // TODO: resetting the animator service strangely breaks things here... not sure why.
    // this.animatorService.reset();

    const setActivePathIdFn = (type: CanvasType) => {
      if (type === CanvasType.Start) {
        this.activePathIdMap.set(CanvasType.Preview, pathId);
      }
      this.activePathIdMap.set(type, pathId);
      const vl = this.importedPathMap.get(pathId);
      this.activeLayerMap.set(type, vl ? vl.clone() : vl);
      const { vl1: startVl, vl2: endVl } =
        LayerUtil.adjustVectorLayerDimensions(
          this.importedPathMap.get(this.getActivePathId(CanvasType.Start)),
          this.importedPathMap.get(this.getActivePathId(CanvasType.End)));
      this.activeLayerMap.set(CanvasType.Start, startVl);
      this.activeLayerMap.set(CanvasType.Preview, startVl ? startVl.clone() : startVl);
      this.activeLayerMap.set(CanvasType.End, endVl);
      // Attempt to make the start and end subpaths compatible with each other.
      this.updateActivePath(type, this.getActivePathLayer(type).pathData, false /* shouldNotify */);
    };

    setActivePathIdFn(canvasType);

    if (shouldNotify) {
      [CanvasType.Preview, CanvasType.Start, CanvasType.End].forEach(type => this.notifyChange(type));
    }
  }

  /**
   * Returns the path layer associated with the currently set
   * active path ID, for the specified canvas type.
   */
  getActivePathLayer(type: CanvasType): PathLayer | undefined {
    const vectorLayer = this.getVectorLayer(type);
    const activePathId = this.getActivePathId(type);
    if (!vectorLayer || !activePathId) {
      return undefined;
    }
    return vectorLayer.findLayer(activePathId) as PathLayer;
  }

  /**
   * Updates the path command at the specified sub path index. The path's previous
   * conversions will be removed and an attempt to make the path compatible with
   * its opposite path layer will be made.
   */
  updateActivePath(
    type: CanvasType,
    path: Path,
    shouldNotify = true) {

    // Remove any existing conversions and collapsing sub paths from the path.
    const pathMutator = path.mutate();
    path.getSubPaths().forEach((_, subIdx) => {
      pathMutator.unconvertSubPath(subIdx);
    });
    path = pathMutator.deleteCollapsingSubPaths().build();

    const oppositeCanvasType =
      type === CanvasType.Start
        ? CanvasType.End
        : CanvasType.Start;
    let hasOppositeCanvasTypeChanged = false;

    const oppActivePathLayer =
      type === CanvasType.Preview ? undefined : this.getActivePathLayer(oppositeCanvasType);
    if (oppActivePathLayer) {
      oppActivePathLayer.pathData =
        oppActivePathLayer.pathData.mutate().deleteCollapsingSubPaths().build();
      const oppPath = oppActivePathLayer.pathData;
      const numSubPaths = path.getSubPaths().length;
      const numOppSubPaths = oppPath.getSubPaths().length;
      if (numSubPaths !== numOppSubPaths) {
        const pathToChange = numSubPaths < numOppSubPaths ? path : oppPath;
        const oppPathToChange = numSubPaths < numOppSubPaths ? oppPath : path;
        const minIdx = Math.min(numSubPaths, numOppSubPaths);
        const maxIdx = Math.max(numSubPaths, numOppSubPaths);
        const mutator = pathToChange.mutate();
        for (let i = minIdx; i < maxIdx; i++) {
          const pole = oppPathToChange.getPoleOfInaccessibility(i);
          mutator.addCollapsingSubPath(
            pole, oppPathToChange.getSubPaths()[i].getCommands().length);
        }
        if (numSubPaths < numOppSubPaths) {
          path = mutator.build();
        } else {
          oppActivePathLayer.pathData = mutator.build();
        }
      }
      for (let subIdx = 0; subIdx < Math.max(numSubPaths, numOppSubPaths); subIdx++) {
        const numCommands = path.getSubPaths()[subIdx].getCommands().length;
        const numOppositeCommands =
          oppActivePathLayer.pathData.getSubPaths()[subIdx].getCommands().length;
        if (numCommands === numOppositeCommands) {
          // Only auto convert when the number of commands in both canvases
          // are equal. Otherwise we'll wait for the user to add more points.
          const autoConvertResults =
            AutoAwesome.autoConvert(
              subIdx, path, oppActivePathLayer.pathData.mutate()
                .unconvertSubPath(subIdx)
                .build());
          path = autoConvertResults.from;

          // This is the one case where a change in one canvas type's vector layer
          // will cause corresponding changes to be made in the opposite canvas type's
          // vector layer.
          oppActivePathLayer.pathData = autoConvertResults.to;
          hasOppositeCanvasTypeChanged = true;
        }
      }
    }

    this.getActivePathLayer(type).pathData = path;

    if (type === CanvasType.Start || hasOppositeCanvasTypeChanged) {
      // A canvas layer has changed, so update the preview layer as well.
      const activeStartLayer = this.getActivePathLayer(CanvasType.Start);
      const activePreviewLayer = this.getActivePathLayer(CanvasType.Preview);
      if (activeStartLayer && activePreviewLayer) {
        activePreviewLayer.pathData = activeStartLayer.pathData.clone();
      }
    }

    if (shouldNotify) {
      this.notifyChange(type);
      if (hasOppositeCanvasTypeChanged) {
        this.notifyChange(oppositeCanvasType);
      }
      // TODO: notifying the preview layer every time could be avoided...
      this.notifyChange(CanvasType.Preview);
    }
  }

  /**
   * Returns the active rotation layer, which will always be the immediate parent
   * of the active path layer.
   */
  getActiveRotationLayer(type: CanvasType) {
    const vectorLayer = this.getVectorLayer(type);
    if (!vectorLayer) {
      return undefined;
    }
    return vectorLayer.findLayer(ROTATION_GROUP_LAYER_ID) as GroupLayer;
  }

  /**
   * Updates the active rotation layer with the new rotation value.
   */
  updateActiveRotationLayer(type: CanvasType, rotation: number, shouldNotify = true) {
    const vectorLayer = this.getVectorLayer(type);
    const activePathLayer = this.getActivePathLayer(type);
    if (!activePathLayer) {
      return;
    }
    const updateRotationLayerFn = (layer: GroupLayer) => {
      layer.pivotX = vectorLayer.width / 2;
      layer.pivotY = vectorLayer.height / 2;
      layer.rotation = rotation;
      if (shouldNotify) {
        this.notifyChange(type);
      }
    };
    const activeRotationLayer = this.getActiveRotationLayer(type);
    if (activeRotationLayer) {
      updateRotationLayerFn(activeRotationLayer);
      return;
    }
    const findActivePathLayerParentFn = (current: Layer, parent: Layer): Layer => {
      if (current === activePathLayer) {
        return parent;
      }
      if (current.children) {
        for (const child of current.children) {
          const potentialParent = findActivePathLayerParentFn(child, current);
          if (potentialParent) {
            return potentialParent;
          }
        }
      }
      return undefined;
    };
    const newRotationLayer = new GroupLayer([activePathLayer], ROTATION_GROUP_LAYER_ID);
    const activePathLayerParent = findActivePathLayerParentFn(vectorLayer, undefined);
    const activePathLayerIndex = activePathLayerParent.children.indexOf(activePathLayer);
    activePathLayerParent.children[activePathLayerIndex] = newRotationLayer;
    updateRotationLayerFn(newRotationLayer);
  }

  /**
   * Notify listeners that the layer state associated with the specified
   * canvas type has changed and that they should update their content.
   */
  notifyChange(type: CanvasType) {
    this.activePathIdSources.get(type).next(this.activePathIdMap.get(type));
    this.statusSource.next(this.getMorphabilityStatus());
  }

  /**
   * Returns a list of imported VectorLayers.
   */
  getImportedVectorLayers() {
    return Array.from(this.importedPathMap.values());
  }

  /**
   * Deletes the path with the specified ID.
   */
  deletePathId(pathId: string) {
    this.deletedPathIds.add(pathId);
    this.importedPathMap.delete(pathId);
    const notifyTypes: CanvasType[] = [];
    [CanvasType.Start, CanvasType.Preview, CanvasType.End]
      .forEach(type => {
        const activeStartPathId = this.activePathIdMap.get(type);
        if (activeStartPathId === pathId) {
          this.activePathIdMap.delete(type);
          this.activeLayerMap.delete(type);
          notifyTypes.push(type);
        }
      });
    for (const type of notifyTypes) {
      this.notifyChange(type);
    }
    this.existingPathIdsSource.next(Array.from(this.importedPathMap.keys()));
  }

  getMorphabilityStatus() {
    const startPathLayer = this.getActivePathLayer(CanvasType.Start);
    const endPathLayer = this.getActivePathLayer(CanvasType.End);
    if (!startPathLayer || !endPathLayer) {
      return MorphabilityStatus.None;
    }
    if (startPathLayer.isMorphableWith(endPathLayer)) {
      return MorphabilityStatus.Morphable;
    }
    return MorphabilityStatus.Unmorphable;
  }

  /**
   * Resets all existing layer state loaded by the application.
   */
  reset() {
    this.appModeService.reset();
    this.selectionService.reset();
    this.hoverService.reset();
    this.animatorService.reset();
    this.importedPathMap.clear();
    this.activePathIdMap.clear();
    this.activeLayerMap.clear();
    this.activePathIdSources.forEach(source => source.next(undefined));
    this.statusSource.next(MorphabilityStatus.None);
    this.deletedPathIds.clear();
    [CanvasType.Preview, CanvasType.Start, CanvasType.End].forEach(type => this.notifyChange(type));
  }

  getExistingPathIdsObservable() {
    return this.existingPathIdsSource.asObservable();
  }

  getActivePathIdObservable(type: CanvasType) {
    return this.activePathIdSources.get(type);
  }

  getMorphabilityStatusObservable() {
    return this.statusSource.asObservable();
  }
}

export enum MorphabilityStatus {
  None,
  Unmorphable,
  Morphable,
}
