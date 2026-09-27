import { INTERPOLATORS } from 'app/modules/editor/model/interpolators';
import {
  ClipPathLayer,
  GroupLayer,
  Layer,
  LayerUtil,
  PathLayer,
  VectorLayer,
} from 'app/modules/editor/model/layers';
import { Animation, AnimationBlock, PathAnimationBlock } from 'app/modules/editor/model/timeline';
import { MathUtil, Matrix } from 'app/modules/editor/scripts/common';
import { breakApartLayers, combineLayers } from 'app/modules/editor/scripts/common/combineLayers';
import * as ModelUtil from 'app/modules/editor/scripts/common/ModelUtil';
import type { LayerDocument } from 'app/modules/editor/scripts/common/pathOpLayers';
import { Action, State, Store } from 'app/modules/editor/store';
import { BatchAction } from 'app/modules/editor/store/batch/actions';
import {
  SetCollapsedLayers,
  SetHiddenLayers,
  SetSelectedLayers,
  SetVectorLayer,
} from 'app/modules/editor/store/layers/actions';
import {
  getCollapsedLayerIds,
  getHiddenLayerIds,
  getSelectedLayerIds,
  getVectorLayer,
} from 'app/modules/editor/store/layers/selectors';
import { getCurrentTime } from 'app/modules/editor/store/playback/selectors';
import {
  SelectAnimation,
  SetAnimation,
  SetSelectedBlocks,
} from 'app/modules/editor/store/timeline/actions';
import {
  getAnimation,
  getSelectedBlockIds,
  isAnimationSelected,
} from 'app/modules/editor/store/timeline/selectors';
import {
  EndPreview,
  IsolateUndoStep,
  SkipUndoStep,
} from 'app/modules/editor/store/undoredo/actions';
import {
  getLastRecordedState,
  isPreviewPending,
} from 'app/modules/editor/store/undoredo/metareducer';
import { difference, find, findIndex, isEqual, uniqueId } from 'lodash-es';

/**
 * A simple service that provides an interface for making layer/timeline changes.
 */
export class LayerTimelineService {
  constructor(private readonly store: Store<State>) {}

  /**
   * Selects or deselects the animation.
   */
  selectAnimation(isSelected: boolean) {
    this.updateSelections(isSelected, new Set(), new Set());
  }

  /**
   * Selects or deselects the specified block ID.
   */
  selectBlock(blockId: string, clearExisting: boolean) {
    const selectedBlockIds = this.getSelectedBlockIds();
    if (clearExisting) {
      selectedBlockIds.forEach(id => {
        if (id !== blockId) {
          selectedBlockIds.delete(id);
        }
      });
    }
    if (!clearExisting && selectedBlockIds.has(blockId)) {
      selectedBlockIds.delete(blockId);
    } else {
      selectedBlockIds.add(blockId);
    }
    this.updateSelections(false, selectedBlockIds, new Set());
  }

  /**
   * Selects or deselects the specified layer ID.
   */
  selectLayer(layerId: string, clearExisting: boolean) {
    const selectedLayerIds = this.getSelectedLayerIds();
    if (clearExisting) {
      selectedLayerIds.forEach(id => {
        if (id !== layerId) {
          selectedLayerIds.delete(id);
        }
      });
    }
    if (!clearExisting && selectedLayerIds.has(layerId)) {
      selectedLayerIds.delete(layerId);
    } else {
      selectedLayerIds.add(layerId);
    }
    this.updateSelections(false, new Set(), selectedLayerIds);
  }

  setSelectedLayers(layerIds: Set<string>) {
    this.updateSelections(false, new Set(), new Set(layerIds));
  }

  /**
   * Selects every visible layer at the top of the tree, like Cmd+A in Figma: groups as a whole,
   * so that grouping, deleting, and moving apply to everything.
   */
  selectAllLayers() {
    const hiddenLayerIds = this.getHiddenLayerIds();
    const layerIds = this.getVectorLayer()
      .children.map(layer => layer.id)
      .filter(id => !hiddenLayerIds.has(id));
    this.setSelectedLayers(new Set(layerIds));
  }

  /**
   * Clears all animation/block/layer selections.
   */
  clearSelections() {
    const actions = this.getClearSelectionsActions();
    if (actions.length) {
      this.store.dispatch(new BatchAction(...actions));
    }
  }

  private getClearSelectionsActions() {
    return this.getUpdateSelectionsActions(false, new Set(), new Set());
  }

  private updateSelections(
    isAnimSelected: boolean,
    selectedBlockIds: ReadonlySet<string>,
    selectedLayerIds: ReadonlySet<string>,
  ) {
    const actions = this.getUpdateSelectionsActions(
      isAnimSelected,
      selectedBlockIds,
      selectedLayerIds,
    );
    if (actions.length) {
      this.store.dispatch(new BatchAction(...actions));
    }
  }

  private getUpdateSelectionsActions(
    isAnimSelected: boolean,
    selectedBlockIds: ReadonlySet<string>,
    selectedLayerIds: ReadonlySet<string>,
  ) {
    const actions: Action[] = [];
    if (this.isAnimationSelected() !== isAnimSelected) {
      actions.push(new SelectAnimation(isAnimSelected));
    }
    if (!isEqual(this.getSelectedBlockIds(), selectedBlockIds)) {
      actions.push(new SetSelectedBlocks(selectedBlockIds));
    }
    if (!isEqual(this.getSelectedLayerIds(), selectedLayerIds)) {
      actions.push(new SetSelectedLayers(selectedLayerIds));
    }
    return actions;
  }

  /**
   * Toggles the specified layer's expanded state.
   */
  toggleExpandedLayer(layerId: string, recursive: boolean) {
    const layerIds = new Set([layerId]);
    if (recursive) {
      const layer = this.getVectorLayer().findLayerById(layerId);
      if (layer) {
        layer.walk(l => layerIds.add(l.id));
      }
    }
    const collapsedLayerIds = this.getCollapsedLayerIds();
    if (collapsedLayerIds.has(layerId)) {
      layerIds.forEach(id => collapsedLayerIds.delete(id));
    } else {
      layerIds.forEach(id => collapsedLayerIds.add(id));
    }
    this.store.dispatch(new SetCollapsedLayers(collapsedLayerIds));
  }

  /**
   * Toggles the specified layer's visibility.
   */
  toggleVisibleLayer(layerId: string) {
    const layerIds = this.getHiddenLayerIds();
    if (layerIds.has(layerId)) {
      layerIds.delete(layerId);
    } else {
      layerIds.add(layerId);
    }
    this.store.dispatch(new SetHiddenLayers(layerIds));
  }

  /**
   * Imports a list of vector layers into the workspace, e.g. one for each imported file. Returns
   * the ids of the top-level layers that each one added, in the same order.
   */
  importLayers(vls: ReadonlyArray<VectorLayer>): ReadonlyArray<ReadonlyArray<string>> {
    if (!vls.length) {
      return [];
    }
    const importedVls = [...vls];
    const vectorLayer = this.getVectorLayer();
    let vectorLayers = [vectorLayer];
    if (!vectorLayer.children.length) {
      // Simply replace the empty vector layer rather than merging with it.
      const vl = importedVls[0].clone();
      vl.name = vectorLayer.name;
      importedVls[0] = vl;
      vectorLayers = [];
    }
    const newVectorLayers = [...vectorLayers, ...importedVls];
    const newVl =
      newVectorLayers.length === 1
        ? newVectorLayers[0]
        : newVectorLayers.reduce(LayerUtil.mergeVectorLayers);
    this.store.dispatch(
      new BatchAction(...this.getClearSelectionsActions(), new SetVectorLayer(newVl)),
    );
    // Merging keeps the layers' ids.
    return importedVls.map(vl =>
      vl.children.map(l => l.id).filter(id => !!newVl.findLayerById(id)),
    );
  }

  /**
   * Adds a layer to the vector tree, in the parent that getParentIdForNewLayer returns.
   */
  addLayer(layer: Layer) {
    const vl = this.getVectorLayer();
    const parentId = this.getParentIdForNewLayer();
    const parent = parentId === vl.id ? undefined : vl.findLayerById(parentId)?.clone();
    if (parent) {
      parent.children = [...parent.children, layer];
      this.updateLayer(parent);
      return;
    }
    const vectorLayer = vl.clone();
    vectorLayer.children = [...vectorLayer.children, layer];
    this.updateLayer(vectorLayer);
  }

  /**
   * Returns the id of the layer that addLayer adds a layer to: the parent of the selected layer,
   * so that the new layer is its sibling, or else the vector layer.
   */
  getParentIdForNewLayer() {
    const vl = this.getVectorLayer();
    const selectedLayers = this.getSelectedLayers();
    if (selectedLayers.length === 1 && !(selectedLayers[0] instanceof VectorLayer)) {
      const parent = LayerUtil.findParent(vl, selectedLayers[0].id);
      if (parent) {
        return parent.id;
      }
    }
    return vl.id;
  }

  /**
   * Sets the current vector layer.
   */
  setVectorLayer(vl: VectorLayer) {
    this.store.dispatch(new SetVectorLayer(vl));
  }

  /**
   * Saves an edit made on the canvas as its own undo step, even if another edit came right before
   * it, since a gesture is one thing to undo. The selected and hidden layers change with it, if
   * they're given, e.g. to select and hide the copies of hidden layers that the edit duplicated.
   */
  commitCanvasEdit(
    vl: VectorLayer,
    animation?: Animation,
    layerIds: {
      readonly selectedLayerIds?: ReadonlySet<string>;
      readonly hiddenLayerIds?: ReadonlySet<string>;
    } = {},
  ) {
    const { selectedLayerIds, hiddenLayerIds } = layerIds;
    const actions: Action[] = [new IsolateUndoStep(), new SetVectorLayer(vl)];
    if (animation && animation !== this.getAnimation()) {
      actions.push(new SetAnimation(animation));
    }
    if (hiddenLayerIds && hiddenLayerIds !== this.getHiddenLayerIds()) {
      actions.push(new SetHiddenLayers(hiddenLayerIds));
    }
    if (selectedLayerIds) {
      actions.push(...this.getUpdateSelectionsActions(false, new Set(), new Set(selectedLayerIds)));
    }
    this.store.dispatch(new BatchAction(...actions));
  }

  /**
   * Updates an existing layer in the tree.
   */
  updateLayer(layer: Layer) {
    this.store.dispatch(new SetVectorLayer(LayerUtil.updateLayer(this.getVectorLayer(), layer)));
  }

  /**
   * Shows an edit to an existing layer without an undo step, e.g. on every move of a drag. Call
   * commitPreview when it ends, or cancelPreview to go back.
   */
  previewLayer(layer: Layer) {
    const vl = LayerUtil.updateLayer(this.getVectorLayer(), layer);
    this.store.dispatch(new BatchAction(new SkipUndoStep(), new SetVectorLayer(vl)));
  }

  /**
   * Shows edits to existing blocks without an undo step, like previewLayer.
   */
  previewBlocks(blocks: ReadonlyArray<AnimationBlock>) {
    if (!blocks.length) {
      return;
    }
    const animation = this.getAnimationWithBlocks(blocks);
    this.store.dispatch(new BatchAction(new SkipUndoStep(), new SetAnimation(animation)));
  }

  /**
   * Saves the previewed layers and blocks as one undo step, however long the previews took and
   * however soon they came after another edit. It does nothing without a pending preview, e.g. if
   * a recorded action during the previews already saved them in its undo step (see
   * isPreviewPending). If the previewed values save the same as the recorded ones, e.g. a color
   * dragged back to where it started, it ends the preview like cancelPreview instead.
   */
  commitPreview() {
    const state = this.store.getState();
    if (!isPreviewPending(state)) {
      return;
    }
    const vl = this.getVectorLayer();
    const animation = this.getAnimation();
    const recorded = getLastRecordedState(state);
    // LayerUtil.updateLayer always returns a new tree, so compare what a project file saves.
    // Serializing once at the end of a drag is cheap next to the previews.
    const isUnchanged =
      isEqual(recorded.layers.vectorLayer.toJSON(), vl.toJSON()) &&
      isEqual(recorded.timeline.animation.toJSON(), animation.toJSON());
    if (isUnchanged) {
      this.cancelPreview();
      return;
    }
    this.store.dispatch(
      new BatchAction(new IsolateUndoStep(), new SetVectorLayer(vl), new SetAnimation(animation)),
    );
  }

  /**
   * Shows the layers and blocks from before the previews again, without an undo step. Like
   * commitPreview, it does nothing without a pending preview. Once a recorded action has saved
   * the previewed values, only undo takes them back.
   */
  cancelPreview() {
    const state = this.store.getState();
    if (!isPreviewPending(state)) {
      return;
    }
    const recorded = getLastRecordedState(state);
    this.store.dispatch(
      new BatchAction(
        new EndPreview(),
        new SetVectorLayer(recorded.layers.vectorLayer),
        new SetAnimation(recorded.timeline.animation),
      ),
    );
  }

  /**
   * Turns a path into a clip path, or a clip path into a path. It keeps the layer's id, so that
   * it stays selected, hidden, and animated. Blocks that the new type can't animate are dropped,
   * which the context menu avoids by only offering it without them (getConvertRefusal).
   */
  convertLayer(layerId: string) {
    const vl = this.getVectorLayer();
    const layer = vl.findLayerById(layerId);
    let converted: Layer;
    if (layer instanceof PathLayer) {
      converted = new ClipPathLayer(layer);
    } else if (layer instanceof ClipPathLayer) {
      converted = new PathLayer(layer);
    } else {
      return;
    }
    const actions: Action[] = [new SetVectorLayer(LayerUtil.replaceLayer(vl, layerId, converted))];
    const animation = this.getAnimation();
    const blocks = animation.blocks.filter(
      b => b.layerId !== layerId || converted.animatableProperties.has(b.propertyName),
    );
    if (blocks.length !== animation.blocks.length) {
      const newAnimation = animation.clone();
      newAnimation.blocks = blocks;
      actions.push(new SetAnimation(newAnimation));
    }
    this.store.dispatch(new BatchAction(...actions));
  }

  /**
   * Combines the selected paths into the bottom one, and selects it (scripts/common/combineLayers.ts).
   * Returns why it can't, if it can't.
   */
  combineSelectedLayers() {
    const combined = combineLayers(this.getDocument(), this.getSelectedLayerIds());
    if (!('layerId' in combined)) {
      return combined.reason;
    }
    const { vectorLayer, animation } = combined.document;
    const removedIds = LayerUtil.runPreorderTraversal(this.getVectorLayer())
      .map(l => l.id)
      .filter(id => !vectorLayer.findLayerById(id));
    this.store.dispatch(
      new BatchAction(
        new SetVectorLayer(vectorLayer),
        new SetAnimation(animation),
        ...this.buildCleanupLayerIdActions(...removedIds),
        new SetSelectedLayers(new Set([combined.layerId])),
      ),
    );
    return undefined;
  }

  /**
   * Splits each of the selected paths into a path for each of its subpaths, and selects them
   * (scripts/common/combineLayers.ts). Returns why it can't, if it can't.
   */
  breakApartSelectedLayers() {
    const brokenApart = breakApartLayers(
      this.getDocument(),
      this.getSelectedLayerIds(),
      this.queryStore(getHiddenLayerIds),
    );
    if (!('layerIds' in brokenApart)) {
      return brokenApart.reason;
    }
    const { vectorLayer, animation } = brokenApart.document;
    const actions: Action[] = [
      new SetVectorLayer(vectorLayer),
      new SetAnimation(animation),
      new SetSelectedLayers(new Set(brokenApart.layerIds)),
    ];
    if (brokenApart.hiddenLayerIds !== this.queryStore(getHiddenLayerIds)) {
      actions.push(new SetHiddenLayers(brokenApart.hiddenLayerIds));
    }
    this.store.dispatch(new BatchAction(...actions));
    return undefined;
  }

  /**
   * Merges the specified group layer into its children layers.
   * TODO: make it possible to merge groups that contain animation blocks?
   */
  flattenGroupLayer(layerId: string) {
    const vl = this.getVectorLayer();
    const layer = vl.findLayerById(layerId) as GroupLayer;
    if (!layer.children.length) {
      return;
    }
    const layerTransform = Matrix.flatten(LayerUtil.getCanvasTransformsForGroupLayer(layer));
    // A group's children are groups, paths, and clip paths.
    const groupChildren = layer.children as ReadonlyArray<GroupLayer | PathLayer | ClipPathLayer>;
    const layerChildren = groupChildren.map((l): Layer => {
      if (l instanceof GroupLayer) {
        const flattenedTransform = Matrix.flatten([
          layerTransform,
          ...LayerUtil.getCanvasTransformsForGroupLayer(l),
        ]);
        const { sx, sy } = flattenedTransform.getScaling();
        const degrees = flattenedTransform.getRotation();
        const { tx, ty } = flattenedTransform.getTranslation();
        l = l.clone();
        l.pivotX = 0;
        l.pivotY = 0;
        l.translateX = tx;
        l.translateY = ty;
        l.rotation = degrees;
        l.scaleX = sx;
        l.scaleY = sy;
        return l;
      }
      l = l.clone();
      if (l instanceof PathLayer && l.strokeWidth) {
        // Group transforms scale strokes too (as they do on Android), so scale the width by the
        // same amount as the path.
        l.strokeWidth = MathUtil.round(l.strokeWidth * layerTransform.getScaleFactor());
      }
      const path = l.pathData;
      if (!path || !path.getPathString()) {
        return l;
      }
      l.pathData = path.mutate().transform(layerTransform).build();
      return l;
    });
    const layerChildrenIds = new Set(layerChildren.map(l => l.id));
    const parent = LayerUtil.findParent(vl, layerId)?.clone();
    if (!parent) {
      return;
    }
    const children = [...parent.children];
    children.splice(
      findIndex(parent.children, l => l.id === layerId),
      1,
      ...layerChildren,
    );
    parent.children = children;
    const actions: Action[] = [
      new SetVectorLayer(LayerUtil.updateLayer(vl, parent)),
      ...this.buildCleanupLayerIdActions(layerId),
    ];
    const newAnimation = this.getAnimation().clone();
    // TODO: show a dialog if the user is about to unknowingly delete any blocks?
    newAnimation.blocks = newAnimation.blocks.filter(b => b.layerId !== layerId);
    // TODO: also attempt to merge children group animation blocks?
    newAnimation.blocks = newAnimation.blocks.map(b => {
      if (!(b instanceof PathAnimationBlock) || !layerChildrenIds.has(b.layerId)) {
        return b;
      }
      const block = b.clone();
      if (block.fromValue) {
        block.fromValue = block.fromValue.mutate().transform(layerTransform).build();
      }
      if (block.toValue) {
        block.toValue = block.toValue.mutate().transform(layerTransform).build();
      }
      return block;
    });
    actions.push(new SetAnimation(newAnimation));
    this.store.dispatch(new BatchAction(...actions));
  }

  private buildCleanupLayerIdActions(...deletedLayerIds: string[]) {
    const collapsedLayerIds = this.getCollapsedLayerIds();
    const hiddenLayerIds = this.getHiddenLayerIds();
    const selectedLayerIds = this.getSelectedLayerIds();
    const differenceFn = (s: ReadonlySet<string>, a: string[]) =>
      new Set(difference(Array.from(s), a));
    const actions: Action[] = [];
    if (deletedLayerIds.some(id => collapsedLayerIds.has(id))) {
      actions.push(new SetCollapsedLayers(differenceFn(collapsedLayerIds, deletedLayerIds)));
    }
    if (deletedLayerIds.some(id => hiddenLayerIds.has(id))) {
      actions.push(new SetHiddenLayers(differenceFn(hiddenLayerIds, deletedLayerIds)));
    }
    if (deletedLayerIds.some(id => selectedLayerIds.has(id))) {
      actions.push(new SetSelectedLayers(differenceFn(selectedLayerIds, deletedLayerIds)));
    }
    return actions;
  }

  /**
   * Groups or ungroups the selected layers.
   */
  groupOrUngroupSelectedLayers(shouldGroup: boolean) {
    let selectedLayerIds = this.getSelectedLayerIds();
    if (!selectedLayerIds.size) {
      return;
    }
    let vl = this.getVectorLayer();

    // Sort selected layers by order they appear in tree.
    let tempSelLayers = Array.from(selectedLayerIds)
      .map(id => vl.findLayerById(id))
      .filter((l): l is Layer => !!l);
    const selLayerOrdersMap: Dictionary<number> = {};
    let n = 0;
    vl.walk(layer => {
      if (find(tempSelLayers, l => l.id === layer.id)) {
        selLayerOrdersMap[layer.id] = n;
        n++;
      }
    });
    tempSelLayers.sort((a, b) => selLayerOrdersMap[a.id] - selLayerOrdersMap[b.id]);

    if (shouldGroup) {
      // Remove any layers that are descendants of other selected layers,
      // and remove the vectorLayer itself if selected.
      tempSelLayers = tempSelLayers.filter(layer => {
        if (layer instanceof VectorLayer) {
          return false;
        }
        let p = LayerUtil.findParent(vl, layer.id);
        while (p) {
          const parentId = p.id;
          if (tempSelLayers.some(l => l.id === parentId)) {
            return false;
          }
          p = LayerUtil.findParent(vl, parentId);
        }
        return true;
      });

      if (!tempSelLayers.length) {
        return;
      }

      // Find destination parent and insertion point.
      const firstSelectedLayerParent = LayerUtil.findParent(vl, tempSelLayers[0].id);
      if (!firstSelectedLayerParent) {
        return;
      }
      const firstSelectedLayerIndexInParent = findIndex(
        firstSelectedLayerParent.children,
        l => l.id === tempSelLayers[0].id,
      );

      // Remove all selected layers from their parents (which may differ) and move them into a new
      // group. The layers are in tree order, so no other selected layer comes before the first one
      // in its parent, and removing them doesn't change its index.
      const newGroup = new GroupLayer({
        name: LayerUtil.getUniqueLayerName([vl], 'group'),
        children: tempSelLayers,
        ...LayerUtil.getCenterPivot(vl, firstSelectedLayerParent.id),
      });
      vl = LayerUtil.removeLayers(vl, ...tempSelLayers.map(l => l.id));
      const parent = vl.findLayerById(firstSelectedLayerParent.id)?.clone();
      if (!parent) {
        return;
      }
      const parentChildren = [...parent.children];
      parentChildren.splice(firstSelectedLayerIndexInParent, 0, newGroup);
      parent.children = parentChildren;
      vl = LayerUtil.updateLayer(vl, parent);
      selectedLayerIds = new Set([newGroup.id]);
    } else {
      // Ungroup selected groups layers.
      const newSelectedLayers: Layer[] = [];
      tempSelLayers
        .filter(layer => layer instanceof GroupLayer)
        .forEach(groupLayer => {
          // Move children into parent.
          const parent = LayerUtil.findParent(vl, groupLayer.id)?.clone();
          if (!parent) {
            return;
          }
          const indexInParent = Math.max(
            0,
            findIndex(parent.children, l => l.id === groupLayer.id),
          );
          const newChildren = [...parent.children];
          newChildren.splice(indexInParent, 0, ...groupLayer.children);
          parent.children = newChildren;
          vl = LayerUtil.updateLayer(vl, parent);
          newSelectedLayers.splice(0, 0, ...groupLayer.children);
          // Delete the parent.
          vl = LayerUtil.removeLayers(vl, groupLayer.id);
        });
      selectedLayerIds = new Set(newSelectedLayers.map(l => l.id));
    }
    this.store.dispatch(
      new BatchAction(new SetVectorLayer(vl), new SetSelectedLayers(selectedLayerIds)),
    );
  }

  deleteSelectedModels() {
    return this.store.dispatch(new BatchAction(...this.getDeleteSelectedModelsActions()));
  }

  getDeleteSelectedModelsActions(): ReadonlyArray<Action> {
    const collapsedLayerIds = this.getCollapsedLayerIds();
    const hiddenLayerIds = this.getHiddenLayerIds();
    const selectedLayerIds = this.getSelectedLayerIds();

    let vl = this.getVectorLayer();
    if (selectedLayerIds.has(vl.id)) {
      vl = new VectorLayer();
      collapsedLayerIds.clear();
      hiddenLayerIds.clear();
    } else {
      selectedLayerIds.forEach(layerId => {
        vl = LayerUtil.removeLayers(vl, layerId);
        collapsedLayerIds.delete(layerId);
        hiddenLayerIds.delete(layerId);
      });
    }

    let animation = this.getAnimation();
    if (this.isAnimationSelected()) {
      animation = new Animation();
    }

    const selectedBlockIds = this.getSelectedBlockIds();
    if (selectedBlockIds.size) {
      animation = animation.clone();
      animation.blocks = animation.blocks.filter(b => !selectedBlockIds.has(b.id));
    }

    // Remove any blocks corresponding to deleted layers.
    const filteredBlocks = animation.blocks.filter(b => !!vl.findLayerById(b.layerId));
    if (filteredBlocks.length !== animation.blocks.length) {
      animation = animation.clone();
      animation.blocks = filteredBlocks;
    }

    return [
      new SetVectorLayer(vl),
      new SetCollapsedLayers(collapsedLayerIds),
      new SetHiddenLayers(hiddenLayerIds),
      new SetSelectedLayers(new Set()),
      new SelectAnimation(false),
      new SetAnimation(animation),
      new SetSelectedBlocks(new Set()),
    ];
  }

  updateBlocks(blocks: ReadonlyArray<AnimationBlock>) {
    if (!blocks.length) {
      return;
    }
    this.store.dispatch(new SetAnimation(this.getAnimationWithBlocks(blocks)));
  }

  private getAnimationWithBlocks(blocks: ReadonlyArray<AnimationBlock>) {
    const animation = this.getAnimation().clone();
    animation.blocks = animation.blocks.map(block => {
      const newBlock = find(blocks, b => block.id === b.id);
      return newBlock ? newBlock : block;
    });
    return animation;
  }

  /**
   * Adds a block for the property that starts and ends at the layer's current value, in the gap
   * closest to the current time, and selects it.
   */
  addBlockForProperty(layerId: string, propertyName: string) {
    const layer = this.getVectorLayer().findLayerById(layerId);
    const property = layer?.inspectableProperties.get(propertyName);
    if (!layer || !property) {
      return;
    }
    const value = property.cloneValue((layer as unknown as Record<string, unknown>)[propertyName]);
    this.addBlocks([
      {
        layerId,
        propertyName,
        fromValue: value,
        toValue: value,
        currentTime: this.queryStore(getCurrentTime),
      },
    ]);
  }

  /**
   * Adds blocks in the gaps closest to their current times. With autoSelectBlocks, the added
   * blocks become the selection. Otherwise the selection stays as it is.
   */
  addBlocks(
    blocks: Array<{
      id?: string;
      layerId: string;
      propertyName: string;
      fromValue: any;
      toValue: any;
      currentTime: number;
      duration?: number;
      interpolator?: string;
    }>,
    autoSelectBlocks = true,
  ) {
    let animation = this.getAnimation();
    const addedBlocks: { id: string }[] = [];
    for (const block of blocks.map(b => ({ ...b, id: b.id || uniqueId() }))) {
      const anim = this.addBlockToAnimation(animation, block);
      if (animation !== anim) {
        animation = anim;
        addedBlocks.push(block);
      }
    }
    if (!autoSelectBlocks) {
      this.store.dispatch(new SetAnimation(animation));
      return;
    }
    this.store.dispatch(
      new BatchAction(
        new SetAnimation(animation),
        new SelectAnimation(false),
        new SetSelectedBlocks(new Set(addedBlocks.map(b => b.id))),
        new SetSelectedLayers(new Set()),
      ),
    );
  }

  private addBlockToAnimation(
    animation: Animation,
    block: {
      id?: string;
      layerId: string;
      propertyName: string;
      fromValue: any;
      toValue: any;
      currentTime: number;
      duration?: number;
      interpolator?: string;
    },
  ) {
    const layer = this.getVectorLayer().findLayerById(block.layerId);
    const property = layer?.animatableProperties.get(block.propertyName);
    if (!layer || !property) {
      return animation;
    }
    const newBlockDuration = block.duration || 100;
    const interpolator = block.interpolator || INTERPOLATORS[0].value;
    const propertyName = block.propertyName;
    const currentTime = block.currentTime;

    // Find the right start time for the block, which should be a gap between
    // neighboring blocks closest to the active time cursor, of a minimum size.
    const blocksByLayerId = ModelUtil.getOrderedBlocksByPropertyByLayer(animation);
    const blockNeighbors = (blocksByLayerId[layer.id] || {})[propertyName] || [];
    let gaps: Array<{ start: number; end: number }> = [];
    for (let i = 0; i < blockNeighbors.length; i++) {
      gaps.push({
        start: i === 0 ? 0 : blockNeighbors[i - 1].endTime,
        end: blockNeighbors[i].startTime,
      });
    }
    gaps.push({
      start: blockNeighbors.length ? blockNeighbors[blockNeighbors.length - 1].endTime : 0,
      end: animation.duration,
    });
    gaps = gaps
      .filter(gap => gap.end - gap.start >= newBlockDuration)
      .map(gap => {
        const dist = Math.min(Math.abs(gap.end - currentTime), Math.abs(gap.start - currentTime));
        return { ...gap, dist };
      })
      .sort((a, b) => a.dist - b.dist);

    if (!gaps.length) {
      // No available gaps, cancel.
      // TODO: show a disabled button to prevent this case?
      console.warn('Ignoring failed attempt to add animation block');
      return animation;
    }

    let startTime = Math.max(currentTime, gaps[0].start);
    const endTime = Math.min(startTime + newBlockDuration, gaps[0].end);
    if (endTime - startTime < newBlockDuration) {
      startTime = endTime - newBlockDuration;
    }

    // Generate the new block.
    let type: 'path' | 'color' | 'number';
    if (property.getTypeName() === 'PathProperty') {
      type = 'path';
    } else if (property.getTypeName() === 'ColorProperty') {
      type = 'color';
    } else {
      type = 'number';
    }

    // TODO: clone the current rendered property value and set the from/to values appropriately
    // const valueAtCurrentTime =
    //   this.studioState_.animationRenderer
    //     .getLayerPropertyValue(layer.id, propertyName);

    const newBlock = AnimationBlock.from({
      id: block.id ? block.id : undefined,
      layerId: layer.id,
      propertyName,
      startTime,
      endTime,
      fromValue: block.fromValue,
      toValue: block.toValue,
      interpolator,
      type,
    });
    animation = animation.clone();
    animation.blocks = [...animation.blocks, newBlock];
    return animation;
  }

  getVectorLayer() {
    return this.queryStore(getVectorLayer);
  }

  getSelectedLayerIds() {
    return new Set(this.queryStore(getSelectedLayerIds));
  }

  getSelectedLayers() {
    const vl = this.getVectorLayer();
    return Array.from(this.getSelectedLayerIds())
      .map(id => vl.findLayerById(id))
      .filter((l): l is Layer => !!l);
  }

  private getHiddenLayerIds() {
    return new Set(this.queryStore(getHiddenLayerIds));
  }

  private getCollapsedLayerIds() {
    return new Set(this.queryStore(getCollapsedLayerIds));
  }

  private getSelectedBlockIds() {
    return new Set(this.queryStore(getSelectedBlockIds));
  }

  getSelectedBlocks() {
    const anim = this.getAnimation();
    const blockIds = this.getSelectedBlockIds();
    return Array.from(blockIds)
      .map(id => find(anim.blocks, b => b.id === id))
      .filter((b): b is AnimationBlock => !!b);
  }

  getAnimation() {
    return this.queryStore(getAnimation);
  }

  /** The layers and the animation, as they're saved. */
  getDocument(): LayerDocument {
    return { vectorLayer: this.getVectorLayer(), animation: this.getAnimation() };
  }

  isAnimationSelected() {
    return this.queryStore(isAnimationSelected);
  }

  private queryStore<T>(selector: (state: State) => T) {
    return selector(this.store.getState());
  }
}
