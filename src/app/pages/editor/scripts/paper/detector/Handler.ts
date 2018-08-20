/**
 * A Handler implements a simple asynchronous message queue. Useful for
 * actions that are inherently asynchronous, such as click events and
 * other gestures.
 */
export class Handler {
  private readonly pendingMessageIds = new Set<number>();

  postDelayed(fn: () => void, delayMillis: number) {
    const id = window.setTimeout(() => {
      this.pendingMessageIds.delete(id);
      fn();
    }, Math.max(0, delayMillis));
    this.pendingMessageIds.add(id);
  }

  hasPendingMessages() {
    return this.pendingMessageIds.size > 0;
  }

  removePendingMessages() {
    this.pendingMessageIds.forEach(id => window.clearTimeout(id));
    this.pendingMessageIds.clear();
  }
}
