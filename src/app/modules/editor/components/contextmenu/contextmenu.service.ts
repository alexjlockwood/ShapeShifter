/** Where the context menu was asked for, which decides what it offers. */
export type ContextMenuTarget = 'canvas' | 'layerList';

export interface ContextMenuRequest {
  // A new request replaces the menu that's open, rather than animating in after it.
  readonly key: number;
  /** Where the menu opens, in client coordinates. */
  readonly position: { readonly x: number; readonly y: number };
  readonly target: ContextMenuTarget;
}

/**
 * Opens the context menu (components/contextmenu/ContextMenuHost.tsx), for the selection as it is
 * when it opens. Whatever opens it selects what it's for first.
 */
export class ContextMenuService {
  private request: ContextMenuRequest | undefined;
  private numRequests = 0;
  private readonly listeners = new Set<() => void>();

  open(position: ContextMenuRequest['position'], target: ContextMenuTarget) {
    this.request = { key: ++this.numRequests, position, target };
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
