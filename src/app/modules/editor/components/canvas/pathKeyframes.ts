import { ClipPathLayer, LayerUtil, PathLayer } from 'app/modules/editor/model/layers';
import { Path } from 'app/modules/editor/model/paths';
import { AnimationBlock, PathAnimationBlock } from 'app/modules/editor/model/timeline';

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

/** Whether a block's ends morph into each other, which paths need the same commands for. */
export function isMorphable(block: AnimationBlock) {
  return block instanceof PathAnimationBlock && block.isAnimatable();
}
