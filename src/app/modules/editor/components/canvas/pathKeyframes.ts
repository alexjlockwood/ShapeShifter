import { ClipPathLayer, LayerUtil, PathLayer } from 'app/modules/editor/model/layers';
import { Path } from 'app/modules/editor/model/paths';
import { PathAnimationBlock } from 'app/modules/editor/model/timeline';
import { AutoAwesome } from 'app/modules/editor/scripts/algorithms';

import type { CanvasDocument } from './CanvasPreview';

/** A value that a path's keyframe is saved in: the layer's own path, or an end of a path block. */
export type PathTarget =
  { readonly kind: 'base' } | { readonly kind: 'fromValue' | 'toValue'; readonly blockId: string };

/**
 * What editing a layer's path at a time changes (docs/canvas-editor.md, phase 5):
 *
 * - `static`: the layer's path isn't animated, so it's the layer's own path.
 * - `keyframe`: the time is at the start or end of a path block, or where the path holds still
 *   between them, so it's the value that shows there. The value on the other side of the hold,
 *   e.g. the start of the next block, changes along with it if it's the same path, so that a
 *   chain of morphs stays connected.
 * - `between`: the path is in the middle of morphing, which can't be edited.
 */
export type PathKeyframe =
  | { readonly type: 'static'; readonly path: Path | undefined }
  | {
      readonly type: 'keyframe';
      readonly path: Path | undefined;
      readonly targets: ReadonlyArray<PathTarget>;
      /** The blocks with an end in the targets, which have to morph. */
      readonly blocks: ReadonlyArray<PathAnimationBlock>;
    }
  | { readonly type: 'between'; readonly block: PathAnimationBlock };

/** Returns the layer's path blocks, in order. */
export function getPathBlocks(
  document: CanvasDocument,
  layerId: string,
): ReadonlyArray<PathAnimationBlock> {
  return document.animation.blocks
    .filter(
      (b): b is PathAnimationBlock =>
        b.layerId === layerId && b.propertyName === 'pathData' && b instanceof PathAnimationBlock,
    )
    .sort((a, b) => a.startTime - b.startTime);
}

/**
 * Returns what editing the layer's path at the time changes, the way AnimationRenderer picks the
 * value it draws, or undefined if the layer doesn't have a path.
 */
export function getPathKeyframe(
  document: CanvasDocument,
  layerId: string,
  time: number,
): PathKeyframe | undefined {
  const layer = document.vectorLayer.findLayerById(layerId);
  if (!(layer instanceof PathLayer || layer instanceof ClipPathLayer)) {
    return undefined;
  }
  const blocks = getPathBlocks(document, layerId);
  if (!blocks.length) {
    return { type: 'static', path: layer.pathData };
  }
  // The block that ended last before the time, and the next one to start.
  let previous: PathAnimationBlock | undefined;
  let next: PathAnimationBlock | undefined;
  for (const block of blocks) {
    if (time < block.startTime) {
      next = block;
      break;
    }
    if (time < block.endTime) {
      if (time > block.startTime) {
        return { type: 'between', block };
      }
      next = block;
      break;
    }
    previous = block;
  }
  const before: PathTarget = previous
    ? { kind: 'toValue', blockId: previous.id }
    : { kind: 'base' };
  const after: PathTarget | undefined = next && { kind: 'fromValue', blockId: next.id };
  // A block that starts now shows its start, and otherwise the value from before holds.
  const shown = after && next && time === next.startTime ? after : before;
  const path = getTargetPath(document, layerId, shown);
  const targets = [shown];
  const other = shown === before ? after : before;
  if (other && isSamePath(getTargetPath(document, layerId, other), path)) {
    targets.push(other);
  }
  const blockIds = new Set(targets.map(t => (t.kind === 'base' ? undefined : t.blockId)));
  return {
    type: 'keyframe',
    path,
    targets,
    blocks: blocks.filter(b => blockIds.has(b.id)),
  };
}

/** Returns the document with the path saved in the targets (see getPathKeyframe). */
export function setKeyframePath(
  document: CanvasDocument,
  layerId: string,
  targets: ReadonlyArray<PathTarget>,
  path: Path,
): CanvasDocument {
  let { vectorLayer, animation } = document;
  if (targets.some(t => t.kind === 'base')) {
    const layer = vectorLayer.findLayerById(layerId);
    if (!(layer instanceof PathLayer || layer instanceof ClipPathLayer)) {
      throw new Error(`Layer ${layerId} doesn't have a path`);
    }
    const clone = layer.clone();
    clone.pathData = path;
    vectorLayer = LayerUtil.replaceLayer(vectorLayer, layerId, clone);
  }
  const ends = new Map<string, Set<'fromValue' | 'toValue'>>();
  for (const target of targets) {
    if (target.kind !== 'base') {
      ends.set(target.blockId, (ends.get(target.blockId) ?? new Set()).add(target.kind));
    }
  }
  if (ends.size) {
    animation = animation.clone();
    animation.blocks = animation.blocks.map(block => {
      const changed = ends.get(block.id);
      if (!changed || !(block instanceof PathAnimationBlock)) {
        return block;
      }
      const clone = block.clone();
      changed.forEach(end => (clone[end] = path));
      return clone;
    });
  }
  return { vectorLayer, animation };
}

/**
 * Auto fixes the blocks that don't morph (AutoAwesome.autoFix), and keeps the values linked to
 * their ends (see getPathKeyframe) the same as them, so that a chain of morphs stays connected. A
 * linked block that stops morphing because of it is auto fixed too, and so on down the chain.
 * Returns the document as it was if nothing changed.
 */
export function autoFixPathBlocks(
  document: CanvasDocument,
  blockIds: ReadonlySet<string>,
): CanvasDocument {
  const layerIds = new Set(
    document.animation.blocks.filter(b => blockIds.has(b.id)).map(b => b.layerId),
  );
  let result = document;
  for (const layerId of layerIds) {
    result = autoFixLayer(result, layerId, blockIds);
  }
  return result;
}

// Fixing a block changes its neighbors, which can change it back, so this stops after a while.
const MAX_FIXES_PER_BLOCK = 4;

function autoFixLayer(document: CanvasDocument, layerId: string, blockIds: ReadonlySet<string>) {
  const blocks = getPathBlocks(document, layerId);
  // The path at each keyframe. Values that are linked share one, so fixing one end of a block
  // changes the values linked to it too.
  const base = { path: getTargetPath(document, layerId, { kind: 'base' }) };
  const froms: Array<{ path: Path | undefined }> = [];
  const tos: Array<{ path: Path | undefined }> = [];
  let before = base;
  for (const block of blocks) {
    const from = isSamePath(before.path, block.fromValue) ? before : { path: block.fromValue };
    before = { path: block.toValue };
    froms.push(from);
    tos.push(before);
  }
  const morphs = (i: number) => {
    const from = froms[i].path;
    const to = tos[i].path;
    return !from || !to || from.isMorphableWith(to);
  };
  const wasMorphing = blocks.map((_, i) => morphs(i));
  for (let fixes = 0; fixes < MAX_FIXES_PER_BLOCK * blocks.length; fixes++) {
    const i = blocks.findIndex((b, j) => !morphs(j) && (blockIds.has(b.id) || wasMorphing[j]));
    const from = froms[i]?.path;
    const to = tos[i]?.path;
    if (!from || !to) {
      break;
    }
    [froms[i].path, tos[i].path] = AutoAwesome.autoFix(from, to);
  }
  let { vectorLayer, animation } = document;
  const layer = vectorLayer.findLayerById(layerId);
  if (
    (layer instanceof PathLayer || layer instanceof ClipPathLayer) &&
    base.path &&
    base.path !== layer.pathData
  ) {
    const clone = layer.clone();
    clone.pathData = base.path;
    vectorLayer = LayerUtil.replaceLayer(vectorLayer, layerId, clone);
  }
  const fixed = new Map<string, PathAnimationBlock>();
  blocks.forEach((block, i) => {
    if (froms[i].path !== block.fromValue || tos[i].path !== block.toValue) {
      const clone = block.clone();
      clone.fromValue = froms[i].path;
      clone.toValue = tos[i].path;
      fixed.set(block.id, clone);
    }
  });
  if (fixed.size) {
    animation = animation.clone();
    animation.blocks = animation.blocks.map(block => fixed.get(block.id) ?? block);
  }
  return vectorLayer === document.vectorLayer && animation === document.animation
    ? document
    : { vectorLayer, animation };
}

function getTargetPath(document: CanvasDocument, layerId: string, target: PathTarget) {
  if (target.kind === 'base') {
    const layer = document.vectorLayer.findLayerById(layerId);
    return layer instanceof PathLayer || layer instanceof ClipPathLayer
      ? layer.pathData
      : undefined;
  }
  const block = document.animation.blocks.find(b => b.id === target.blockId);
  return block instanceof PathAnimationBlock ? block[target.kind] : undefined;
}

function isSamePath(a: Path | undefined, b: Path | undefined) {
  return !!a && !!b && (a === b || a.getPathString() === b.getPathString());
}
