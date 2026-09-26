// localStorage can be missing or throw on access: it's null in WebViews with DOM storage turned
// off, and reading it throws a SecurityError when cookies are blocked or in a sandboxed iframe.
// Saved preferences aren't worth failing over, so these fall back to not persisting anything.

/** Returns the stored value for the key, or null if there isn't one or storage is unavailable. */
export function getStoredItem(key: string) {
  try {
    return window.localStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

/** Stores the value for the key. Does nothing if storage is unavailable or full. */
export function setStoredItem(key: string, value: string) {
  try {
    window.localStorage?.setItem(key, value);
  } catch {
    // Nothing to do. The value lasts for this session only.
  }
}
