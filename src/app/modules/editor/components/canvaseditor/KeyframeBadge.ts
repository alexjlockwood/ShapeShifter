import type { PathKeyframe } from 'app/modules/editor/components/canvas/pathKeyframes';
import { on } from 'app/modules/editor/scripts/dom';

/** What the badge says about the selected path at the current time. */
export type KeyframeStatus =
  | {
      readonly type: 'keyframe';
      readonly label: string;
      /** The blocks whose ends no longer morph, which auto fix fixes. */
      readonly brokenBlockIds: ReadonlyArray<string>;
    }
  | { readonly type: 'between'; readonly startTime: number; readonly endTime: number };

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
    const { startTime, endTime } = keyframe.block;
    return { type: 'between', startTime, endTime };
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
  };
}

/**
 * Says whether the selected path's morph still works while it's edited at one of its ends, with a
 * button that auto fixes it when it doesn't, or that it's morphing at the current time, with
 * buttons to go to either end. It's plain DOM at the bottom of the canvas panel, like the toolbar.
 */
export class KeyframeBadge {
  private readonly element: HTMLElement;
  private readonly removeListeners: Array<() => void> = [];
  private status: KeyframeStatus | undefined;

  constructor(
    root: HTMLElement,
    private readonly callbacks: {
      readonly onAutoFix: (blockIds: ReadonlyArray<string>) => void;
      readonly onSeek: (time: number) => void;
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
