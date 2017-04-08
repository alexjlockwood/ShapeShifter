import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';
import { Layer, VectorLayer, PathLayer, GroupLayer } from '../scripts/layers';
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
  private readonly stateMap = new Map<string, VectorLayer>();
  private readonly activePathIdMap = new Map<CanvasType, string>();
  private readonly existingPathIdsSource = new BehaviorSubject<ReadonlyArray<string>>([]);
  private readonly activePathIdSources = new Map<CanvasType, BehaviorSubject<string>>();
  private readonly statusSource = new BehaviorSubject<MorphabilityStatus>(MorphabilityStatus.None);

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
   * Imports all paths in the specified VectorLayer into the application's state map.
   */
  addVectorLayers(vectorLayers: VectorLayer[], clearExistingState = false) {
    if (clearExistingState) {
      this.stateMap.clear();
      this.activePathIdMap.clear();
    }
    for (const vl of vectorLayers) {
      const stateMap = this.stateMap;
      (function recurseFn(layer: Layer) {
        if (layer instanceof PathLayer) {
          if (stateMap.has(layer.id)) {
            console.warn(
              'Ignoring attempt to add path ID to state map', stateMap, vl, layer.id);
            return;
          }
          stateMap.set(layer.id, vl.clone());
          return;
        }
        if (layer.children) {
          layer.children.forEach(l => recurseFn(l));
        }
      })(vl);
    }
    this.existingPathIdsSource.next(Array.from(this.stateMap.keys()));
  }

  /**
   * Returns a list of all path IDs in this VectorLayer.
   */
  getExistingPathIds() {
    const ids: string[] = [];
    this.stateMap.forEach(vl => {
      (function recurseFn(layer: Layer) {
        if (layer instanceof PathLayer) {
          ids.push(layer.id);
          return;
        }
        if (layer.children) {
          layer.children.forEach(l => recurseFn(l));
        }
      })(vl);
    });
    return ids;
  }

  /**
   * Returns the currently set vector layer for the specified canvas type.
   */
  getVectorLayer(canvasType: CanvasType): VectorLayer | undefined {
    return this.getVectorLayerByPathId(this.getActivePathId(canvasType));
  }

  /**
   * Returns the specified path's parent VectorLayer.
   */
  getVectorLayerByPathId(pathId: string) {
    return this.stateMap.get(pathId);
  }

  /**
   * Called by the PathSelectorComponent when a new vector layer path is selected.
   */
  setActivePathId(canvasType: CanvasType, pathId: string, shouldNotify = true) {
    this.appModeService.reset();
    this.selectionService.reset();
    this.hoverService.reset();

    // TODO: resetting the animator service strangely breaks things here... not sure why.
    // this.animatorService.reset();

    const setActivePathIdFn = (type: CanvasType) => {
      this.activePathIdMap.set(type, pathId);
      if (type !== CanvasType.Preview) {
        // Attempt to make the start and end subpaths compatible with each other.
        this.updateActivePath(type, this.getActivePathLayer(type).pathData, false /* shouldNotify */);
      }
    };

    const notifyTypes = [canvasType];
    if (canvasType === CanvasType.Start) {
      setActivePathIdFn(CanvasType.Preview);
      notifyTypes.unshift(CanvasType.Preview);
    }
    setActivePathIdFn(canvasType);

    if (shouldNotify) {
      notifyTypes.forEach(type => this.notifyChange(type));
    }
  }

  /**
   * Returns the currently set active path ID for the specified canvas type.
   */
  getActivePathId(type: CanvasType): string | undefined {
    return this.activePathIdMap.get(type);
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

    const oppositeActivePathLayer =
      type === CanvasType.Preview ? undefined : this.getActivePathLayer(oppositeCanvasType);
    if (oppositeActivePathLayer) {
      oppositeActivePathLayer.pathData =
        oppositeActivePathLayer.pathData.mutate().deleteCollapsingSubPaths().build();
      const oppositePath = oppositeActivePathLayer.pathData;
      const numSubPaths = path.getSubPaths().length;
      const numOppositeSubPaths = oppositePath.getSubPaths().length;
      if (numSubPaths !== numOppositeSubPaths) {
        const pathToChange = numSubPaths < numOppositeSubPaths ? path : oppositePath;
        const oppositePathToChange = numSubPaths < numOppositeSubPaths ? oppositePath : path;
        const minIdx = Math.min(numSubPaths, numOppositeSubPaths);
        const maxIdx = Math.max(numSubPaths, numOppositeSubPaths);
        const mutator = pathToChange.mutate();
        for (let i = minIdx; i < maxIdx; i++) {
          const pole = oppositePathToChange.getPoleOfInaccessibility(i);
          mutator.addCollapsingSubPath(
            pole, oppositePathToChange.getSubPaths()[i].getCommands().length);
        }
        if (numSubPaths < numOppositeSubPaths) {
          path = mutator.build();
        } else {
          oppositeActivePathLayer.pathData = mutator.build();
        }
      }
      for (let subIdx = 0; subIdx < Math.max(numSubPaths, numOppositeSubPaths); subIdx++) {
        const numCommands = path.getSubPaths()[subIdx].getCommands().length;
        const numOppositeCommands =
          oppositeActivePathLayer.pathData.getSubPaths()[subIdx].getCommands().length;
        if (numCommands === numOppositeCommands) {
          // Only auto convert when the number of commands in both canvases
          // are equal. Otherwise we'll wait for the user to add more points.
          const autoConvertResults =
            AutoAwesome.autoConvert(
              subIdx, path, oppositeActivePathLayer.pathData.mutate()
                .unconvertSubPath(subIdx)
                .build());
          path = autoConvertResults.from;

          // This is the one case where a change in one canvas type's vector layer
          // will cause corresponding changes to be made in the opposite canvas type's
          // vector layer.
          oppositeActivePathLayer.pathData = autoConvertResults.to;
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
    this.stateMap.clear();
    this.activePathIdMap.clear();
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
