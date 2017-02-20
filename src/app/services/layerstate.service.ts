import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';
import { Layer, VectorLayer, PathLayer, GroupLayer } from '../scripts/layers';
import { CanvasType } from '../CanvasType';
import { PathCommand } from '../scripts/commands';
import { AutoAwesome } from '../scripts/commands';
import { ROTATION_GROUP_LAYER_ID } from '../scripts/parsers';

/**
 * The global state service that is in charge of keeping track of the loaded
 * SVGs, active path layers, and the current morphability status.
 */
@Injectable()
export class LayerStateService {
  private readonly vectorLayerMap = new Map<CanvasType, VectorLayer>();
  private readonly activePathIdMap = new Map<CanvasType, string>();
  private readonly vectorLayerSources = new Map<CanvasType, BehaviorSubject<VectorLayer>>();
  private readonly activePathIdSources = new Map<CanvasType, BehaviorSubject<string>>();
  private readonly statusSource = new BehaviorSubject<MorphabilityStatus>(MorphabilityStatus.None);

  constructor() {
    [CanvasType.Start, CanvasType.Preview, CanvasType.End]
      .forEach(type => {
        this.vectorLayerSources.set(type, new BehaviorSubject<VectorLayer>(undefined));
        this.activePathIdSources.set(type, new BehaviorSubject<string>(undefined));
      });
  }

  /**
   * Called by the PathSelectorComponent when a new vector layer is imported.
   * The previously set active path ID will be cleared if one exists.
   */
  setVectorLayer(type: CanvasType, layer: VectorLayer, shouldNotify = true) {
    this.vectorLayerMap.set(type, layer);
    this.activePathIdMap.delete(type);
    if (shouldNotify) {
      this.notifyChange(type);
    }
  }

  /**
   * Returns the currently set vector layer for the specified canvas type.
   */
  getVectorLayer(type: CanvasType): VectorLayer | undefined {
    return this.vectorLayerMap.get(type);
  }

  /**
   * Called by the PathSelectorComponent when a new vector layer path is selected.
   */
  setActivePathId(type: CanvasType, pathId: string, shouldNotify = true) {
    this.activePathIdMap.set(type, pathId);
    const activePathLayer = this.getActivePathLayer(type);
    const numSubPaths = activePathLayer.pathData.subPathCommands.length;
    for (let subIdx = 0; subIdx < numSubPaths; subIdx++) {
      // TODO: avoid sending multiple notifications like this
      this.replaceActivePathCommand(type, activePathLayer.pathData, subIdx, shouldNotify);
    }
    if (!numSubPaths && shouldNotify) {
      // Don't think this will ever happen, but just in case.
      this.notifyChange(type);
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
   * Replaces the path command at the specified sub path index. The path's previous
   * conversions will be removed and an attempt to make the path compatible with
   * its target will be made.
   */
  replaceActivePathCommand(type: CanvasType, pathCommand: PathCommand, subIdx: number, shouldNotify = true) {
    // Remove any existing conversions.
    pathCommand = pathCommand.unconvert(subIdx);

    const targetType = type === CanvasType.Start ? CanvasType.End : CanvasType.Start;
    let hasTargetCommandChanged = false;

    const targetActivePathLayer = this.getActivePathLayer(targetType);
    if (targetActivePathLayer) {
      const numCommands = pathCommand.subPathCommands[subIdx].commands.length;
      const numTargetCommands =
        targetActivePathLayer.pathData.subPathCommands[subIdx].commands.length;
      if (numCommands === numTargetCommands) {
        // Only auto convert when the number of commands in both canvases
        // are equal. Otherwise we'll wait for the user to add more points.
        const autoConvertResults =
          AutoAwesome.autoConvert(
            subIdx, pathCommand, targetActivePathLayer.pathData.unconvert(subIdx));
        pathCommand = autoConvertResults.from;

        // This is the one case where a change in one canvas type's vector layer
        // will cause corresponding changes to be made in the target canvas type's
        // vector layer.
        targetActivePathLayer.pathData = autoConvertResults.to;
        hasTargetCommandChanged = true;
      }
    }
    this.getActivePathLayer(type).pathData = pathCommand;

    if (type === CanvasType.Start || hasTargetCommandChanged) {
      // The start canvas layer has changed, so update the preview layer as well.
      const activeStartLayer = this.getActivePathLayer(CanvasType.Start);
      const activePreviewLayer = this.getActivePathLayer(CanvasType.Preview);
      if (activeStartLayer && activePreviewLayer) {
        activePreviewLayer.pathData = activeStartLayer.pathData.clone();
      }
    }

    if (shouldNotify) {
      this.notifyChange(type);
      if (hasTargetCommandChanged) {
        this.notifyChange(targetType);
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
    const findActivePathLayerParentFn = (current: Layer, parent: Layer) => {
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
    this.vectorLayerSources.get(type).next(this.vectorLayerMap.get(type));
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
    const canvasTypes = [CanvasType.Preview, CanvasType.Start, CanvasType.End];
    canvasTypes.forEach(type => this.setVectorLayer(type, undefined, false));
    canvasTypes.forEach(type => this.notifyChange(type));
  }

  getVectorLayerObservable(type: CanvasType) {
    return this.vectorLayerSources.get(type);
  }

  getActivePathIdObservable(type: CanvasType) {
    return this.activePathIdSources.get(type);
  }

  getMorphabilityStatusObservable() {
    return this.statusSource.asObservable();
  }
}

// TODO: also need to handle case where paths are invalid (i.e. unequal # of subpaths)
export enum MorphabilityStatus {
  None,
  Unmorphable,
  Morphable,
}
