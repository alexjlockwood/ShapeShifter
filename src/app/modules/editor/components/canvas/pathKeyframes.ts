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
 *
 * Auto fix only works on two paths at a time, so the fixes on either side of a keyframe can undo
 * each other, e.g. when one adds a collapsing subpath that the other removes. Then the blocks
 * stop sharing that keyframe: each gets its own copy, fixed on its own. The copies draw the same
 * shape, since auto fix only adds points, converts, reorders, reverses, and shifts, and adds
 * subpaths that collapse to a point, so the path doesn't visibly jump there, but editing the
 * keyframe no longer changes both. So a block that morphed before still does afterward, and a
 * block to fix morphs afterward whenever auto fixing it on its own would make it morph.
 *
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

/** The paths that fixChain settled on, and the blocks that had to morph and still don't. */
interface ChainFix {
  readonly base: Path | undefined;
  readonly froms: ReadonlyArray<Path | undefined>;
  readonly tos: ReadonlyArray<Path | undefined>;
  readonly broken: ReadonlyArray<number>;
}

const morphs = (from: Path | undefined, to: Path | undefined) =>
  !from || !to || from.isMorphableWith(to);

function autoFixLayer(document: CanvasDocument, layerId: string, blockIds: ReadonlySet<string>) {
  const blocks = getPathBlocks(document, layerId);
  const base = getTargetPath(document, layerId, { kind: 'base' });
  // Whether each block starts with the value that shows before it: the layer's own path for the
  // first block, and the end of the previous block for the rest.
  let links = blocks.map((block, i) =>
    isSamePath(i ? blocks[i - 1].toValue : base, block.fromValue),
  );
  const wasMorphing = blocks.map(b => morphs(b.fromValue, b.toValue));
  const mustMorph = blocks.map((b, i) => wasMorphing[i] || blockIds.has(b.id));
  const fixableAlone = new Map<number, boolean>();
  const isFixableAlone = (i: number) => {
    let result = fixableAlone.get(i);
    if (result === undefined) {
      const { fromValue, toValue } = blocks[i];
      result = !!fromValue && !!toValue && morphs(...AutoAwesome.autoFix(fromValue, toValue));
      fixableAlone.set(i, result);
    }
    return result;
  };
  // The links that can make fixes undo each other: those between two blocks that have to morph.
  // The layer's own path, and a block that doesn't have to morph, are never auto fixed, so they
  // only follow the value they're linked to.
  const getCuttableLinks = (i: number) =>
    [i, i + 1].filter(
      j => j > 0 && j < blocks.length && links[j] && mustMorph[j - 1] && mustMorph[j],
    );

  let chainFix = fixChain(blocks, base, links, mustMorph);
  for (;;) {
    // A block that morphed before morphs on its own, and so does one that auto fix can fix on its
    // own. Others would stay broken anyway, so their links stay.
    const i = chainFix.broken.find(
      j => getCuttableLinks(j).length && (wasMorphing[j] || isFixableAlone(j)),
    );
    if (i === undefined) {
      break;
    }
    // Cut one of its links, whichever leaves fewer blocks broken, and start over.
    let best: { links: boolean[]; chainFix: ChainFix } | undefined;
    for (const cut of getCuttableLinks(i)) {
      const tried = links.map((linked, j) => linked && j !== cut);
      const triedFix = fixChain(blocks, base, tried, mustMorph);
      if (!best || triedFix.broken.length < best.chainFix.broken.length) {
        best = { links: tried, chainFix: triedFix };
      }
    }
    if (!best) {
      break;
    }
    ({ links, chainFix } = best);
  }

  let { vectorLayer, animation } = document;
  const layer = vectorLayer.findLayerById(layerId);
  if (
    (layer instanceof PathLayer || layer instanceof ClipPathLayer) &&
    chainFix.base &&
    chainFix.base !== layer.pathData
  ) {
    const clone = layer.clone();
    clone.pathData = chainFix.base;
    vectorLayer = LayerUtil.replaceLayer(vectorLayer, layerId, clone);
  }
  const fixed = new Map<string, PathAnimationBlock>();
  blocks.forEach((block, i) => {
    const from = chainFix.froms[i];
    const to = chainFix.tos[i];
    if (from !== block.fromValue || to !== block.toValue) {
      const clone = block.clone();
      clone.fromValue = from;
      clone.toValue = to;
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

/**
 * Auto fixes the blocks that have to morph and don't, starting from their paths in the document,
 * with the values that are linked (links[i] links the start of block i to the value before it)
 * kept the same.
 */
function fixChain(
  blocks: ReadonlyArray<PathAnimationBlock>,
  base: Path | undefined,
  links: ReadonlyArray<boolean>,
  mustMorph: ReadonlyArray<boolean>,
): ChainFix {
  // The path at each keyframe. Values that are linked share one, so fixing one end of a block
  // changes the values linked to it too.
  const baseValue = { path: base };
  const froms: Array<{ path: Path | undefined }> = [];
  const tos: Array<{ path: Path | undefined }> = [];
  let before = baseValue;
  blocks.forEach((block, i) => {
    froms.push(links[i] ? before : { path: block.fromValue });
    before = { path: block.toValue };
    tos.push(before);
  });
  const isBroken = (i: number) => mustMorph[i] && !morphs(froms[i].path, tos[i].path);
  const fixes = blocks.map(() => 0);
  for (;;) {
    // A block that auto fix can't fix would keep being picked, so each one gets a few tries.
    const i = blocks.findIndex((unused, j) => isBroken(j) && fixes[j] < MAX_FIXES_PER_BLOCK);
    const from = froms[i]?.path;
    const to = tos[i]?.path;
    if (!from || !to) {
      break;
    }
    fixes[i]++;
    [froms[i].path, tos[i].path] = AutoAwesome.autoFix(from, to);
  }
  return {
    base: baseValue.path,
    froms: froms.map(v => v.path),
    tos: tos.map(v => v.path),
    broken: blocks.map((unused, i) => i).filter(isBroken),
  };
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
