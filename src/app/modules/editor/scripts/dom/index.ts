type EventMapOf<T extends EventTarget> = T extends Window
  ? WindowEventMap
  : T extends Document
    ? DocumentEventMap
    : HTMLElementEventMap;

/**
 * Adds an event listener and returns a function that removes it. Like with jQuery, returning
 * false from the listener prevents the default action and stops the event from propagating.
 */
export function on<T extends EventTarget, K extends keyof EventMapOf<T> & string>(
  target: T,
  type: K,
  listener: (event: EventMapOf<T>[K]) => boolean | void,
  options?: AddEventListenerOptions,
) {
  const wrappedListener = (event: Event) => {
    if (listener(event as EventMapOf<T>[K]) === false) {
      event.preventDefault();
      event.stopPropagation();
    }
  };
  target.addEventListener(type, wrappedListener, options);
  return () => target.removeEventListener(type, wrappedListener, options);
}
