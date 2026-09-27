import type { PathKeyframe } from 'app/modules/editor/components/canvas/pathKeyframes';
import { on } from 'app/modules/editor/scripts/dom';

/** What the badge says about the selected path at the current time. */
export type KeyframeStatus =
  | {
      readonly type: 'keyframe';
      readonly label: string;
      /** The blocks whose ends no longer morph, which auto fix fixes. */
      readonly brokenBlockIds: ReadonlyArray<string>;
      /**
       * The blocks with an end at the time, in order, whose morphs can be edited in action mode.
       * Where two morphs meet, there's one on each side.
       */
      readonly morphBlockIds: ReadonlyArray<string>;
    }
  | {
      readonly type: 'between';
      readonly startTime: number;
      readonly endTime: number;
      /** The block that's morphing. */
      readonly blockId: string;
    };

/**
 * Returns what to say about editing a path at the time: which end of a morph an edit changes and
 * whether it still morphs, or that the path is morphing, so it can't be edited. There's nothing to
 * say about a path that isn't animated.
 */
export function getKeyframeStatus(
  keyframe: PathKeyframe | undefined,
  time: number,
): KeyframeStatus | undefined {
  if (!keyframe || keyframe.type === 'static') {
    return undefined;
  }
  if (keyframe.type === 'between') {
    const { startTime, endTime, id } = keyframe.block;
    return { type: 'between', startTime, endTime, blockId: id };
  }
  const kinds = new Set(keyframe.targets.map(t => t.kind));
  const place =
    kinds.has('fromValue') && kinds.has('toValue')
      ? 'Where two morphs meet'
      : kinds.has('fromValue')
        ? 'Start of the morph'
        : kinds.has('toValue')
          ? 'End of the morph'
          : 'Before the morph';
  return {
    type: 'keyframe',
    label: `${place}, at ${time} ms`,
    brokenBlockIds: keyframe.blocks.filter(b => !b.isAnimatable()).map(b => b.id),
    morphBlockIds: keyframe.blocks.map(b => b.id),
  };
}

/**
 * Returns the blocks the badge is about: the one that's morphing, or those with an end at the
 * time, in order.
 */
export function getKeyframeBlockIds(status: KeyframeStatus | undefined): ReadonlyArray<string> {
  if (!status) {
    return [];
  }
  return status.type === 'between' ? [status.blockId] : status.morphBlockIds;
}

/**
 * Says whether the selected path's morph still works while it's edited at one of its ends, with a
 * button that auto fixes it when it doesn't, or that it's morphing at the current time, with
 * buttons to go to either end. Either way, it has a button that edits the morph in action mode.
 * Right-clicking it opens a menu for its blocks. It's plain DOM at the bottom of the canvas panel,
 * like the toolbar.
 */
export class KeyframeBadge {
  private readonly element: HTMLElement;
  private readonly removeListeners: Array<() => void> = [];
  private status: KeyframeStatus | undefined;

  constructor(
    root: HTMLElement,
    private readonly callbacks: {
      readonly onAutoFix: (blockIds: ReadonlyArray<string>) => void;
      readonly onEditMorph: (blockId: string) => void;
      readonly onSeek: (time: number) => void;
      /**
       * Opens the context menu for the badge's blocks (getKeyframeBlockIds), at the point in
       * client coordinates.
       */
      readonly onContextMenu: (
        blockIds: ReadonlyArray<string>,
        point: { readonly x: number; readonly y: number },
      ) => void;
    },
  ) {
    this.element = document.createElement('div');
    this.element.className = 'canvas-editor-keyframe';
    this.element.setAttribute('role', 'status');
    this.element.hidden = true;
    // Presses on the badge aren't gestures on the canvas under it.
    this.removeListeners.push(
      on(this.element, 'pointerdown', event => event.stopPropagation()),
      on(this.element, 'pointermove', event => event.stopPropagation()),
      // The canvas's own context menu leaves the badge alone (CanvasController).
      on(this.element, 'contextmenu', event => {
        event.preventDefault();
        const blockIds = getKeyframeBlockIds(this.status);
        if (blockIds.length) {
          this.callbacks.onContextMenu(blockIds, { x: event.clientX, y: event.clientY });
        }
      }),
    );
    root.appendChild(this.element);
  }

  show(status: KeyframeStatus | undefined) {
    if (JSON.stringify(status) === JSON.stringify(this.status)) {
      return;
    }
    this.status = status;
    this.element.hidden = !status;
    this.element.replaceChildren();
    if (!status) {
      return;
    }
    if (status.type === 'between') {
      this.addText(
        `Morphing from ${status.startTime} to ${status.endTime} ms. Edit the path at either end.`,
      );
      this.addButton('Go to start', () => this.callbacks.onSeek(status.startTime));
      this.addButton('Go to end', () => this.callbacks.onSeek(status.endTime));
      this.addButton('Edit morph', () => this.callbacks.onEditMorph(status.blockId));
      return;
    }
    this.addText(status.label);
    const isMorphable = !status.brokenBlockIds.length;
    const morph = this.addText(isMorphable ? 'Morphs' : "Doesn't morph");
    morph.classList.add(isMorphable ? 'is-morphable' : 'is-broken');
    if (!isMorphable) {
      morph.title = 'Both ends of a morph need the same number and types of commands';
      this.addButton('Auto fix', () => this.callbacks.onAutoFix(status.brokenBlockIds));
    }
    const { morphBlockIds } = status;
    morphBlockIds.forEach((blockId, i) => {
      const label =
        morphBlockIds.length === 1
          ? 'Edit morph'
          : i === 0
            ? 'Edit previous morph'
            : 'Edit next morph';
      this.addButton(label, () => this.callbacks.onEditMorph(blockId));
    });
  }

  dispose() {
    this.removeListeners.forEach(remove => remove());
    this.element.remove();
  }

  private addText(text: string) {
    const span = document.createElement('span');
    span.textContent = text;
    this.element.appendChild(span);
    return span;
  }

  private addButton(label: string, onClick: () => void) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.addEventListener('click', event => {
      onClick();
      if (event.detail > 0) {
        // So that the keyboard shortcuts go back to the canvas editor.
        button.blur();
      }
    });
    this.element.appendChild(button);
  }
}
