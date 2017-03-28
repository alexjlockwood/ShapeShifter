import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';
import { Layer, VectorLayer, PathLayer, GroupLayer } from '../scripts/layers';
import { CanvasType } from '../CanvasType';
import { Path } from '../scripts/commands';
import { AutoAwesome } from '../scripts/autoawesome';
import { ROTATION_GROUP_LAYER_ID } from '../scripts/import';
import { SelectionStateService } from './selectionstate.service';
import { HoverStateService } from './hoverstate.service';
import { AnimatorService } from './animator.service';
import { CanvasModeService } from './canvasmode.service';

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

  constructor(
    private readonly selectionStateService: SelectionStateService,
    private readonly hoverStateService: HoverStateService,
    private readonly animatorService: AnimatorService,
    private readonly canvasModeService: CanvasModeService,
  ) {
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
  setActivePathIds(ids: Array<{ type: CanvasType, pathId: string }>, shouldNotify = true) {
    this.canvasModeService.reset();
    this.selectionStateService.reset();
    this.hoverStateService.reset();
    // TODO: resetting the animator service strangely breaks things here... not sure why.
    // this.animatorService.reset();
    ids.forEach(id => this.activePathIdMap.set(id.type, id.pathId));
    ids.forEach(id => {
      const activePathLayer = this.getActivePathLayer(id.type);
      // Attempt to make each corresponding pair of subpaths compatible with each other.
      this.updateActivePath(id.type, activePathLayer.pathData, false);
    });
    if (shouldNotify) {
      ids.forEach(id => this.notifyChange(id.type));
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
      // The start canvas layer has changed, so update the preview layer as well.
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
    this.canvasModeService.reset();
    this.selectionStateService.reset();
    this.hoverStateService.reset();
    this.animatorService.reset();
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
