/**
 * Where the context menu was asked for, which decides what it offers: the layers on the canvas or
 * in the layer list, the selected blocks in the timeline, or the blocks of the canvas editor's
 * keyframe badge.
 */
export type ContextMenuTarget = 'canvas' | 'layerList' | 'timelineBlock' | 'keyframeBadge';

export interface ContextMenuRequest {
  // A new request replaces the menu that's open, rather than animating in after it.
  readonly key: number;
  /** Where the menu opens, in client coordinates. */
  readonly position: { readonly x: number; readonly y: number };
  readonly target: ContextMenuTarget;
  /**
   * The blocks the menu is for, if they aren't the selected ones, e.g. the keyframe badge's. The
   * badge is about the selected path, which selecting its blocks would deselect.
   */
  readonly blockIds?: ReadonlyArray<string>;
}

/**
 * Opens the context menu (components/contextmenu/ContextMenuHost.tsx), for the selection as it is
 * when it opens. Whatever opens it selects what it's for first.
 */
export class ContextMenuService {
  private request: ContextMenuRequest | undefined;
  private numRequests = 0;
  private readonly listeners = new Set<() => void>();

  open(
    position: ContextMenuRequest['position'],
    target: ContextMenuTarget,
    blockIds?: ReadonlyArray<string>,
  ) {
    this.request = { key: ++this.numRequests, position, target, blockIds };
    this.listeners.forEach(listener => listener());
  }

  close() {
    if (this.request) {
      this.request = undefined;
      this.listeners.forEach(listener => listener());
    }
  }

  // These are arrow functions so that they can be passed to useSyncExternalStore.
  readonly getRequest = () => this.request;

  readonly subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
}
