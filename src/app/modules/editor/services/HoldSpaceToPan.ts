/**
 * Decides what the space bar does when the canvas can pan: holding it and dragging pans, and
 * tapping it plays and pauses, like in Figma. Playback toggles when the key comes back up, but
 * only if it went down here (not in a text field, say) and nothing panned in between.
 */
export class HoldSpaceToPan {
  private isDown = false;
  private hasPanned = false;

  isHeld() {
    return this.isDown;
  }

  keyDown({ repeat }: { readonly repeat: boolean }) {
    // A held key repeats, and that isn't a new press.
    if (!repeat && !this.isDown) {
      this.isDown = true;
      this.hasPanned = false;
    }
  }

  /** Returns whether the press was a tap, which plays or pauses. */
  keyUp() {
    const isTap = this.isDown && !this.hasPanned;
    this.reset();
    return isTap;
  }

  pan() {
    if (this.isDown) {
      this.hasPanned = true;
    }
  }

  /** Forgets the press, e.g. when the window loses focus and the key's release won't arrive. */
  reset() {
    this.isDown = false;
    this.hasPanned = false;
  }
}
