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

type Dimension = 'width' | 'height';

/** Returns the size of the element's content box, like jQuery's width() and height(). */
export function getContentSize(element: HTMLElement, dimension: Dimension) {
  const style = getComputedStyle(element);
  const size = parseFloat(style[dimension]);
  return style.boxSizing === 'border-box' ? size - getPaddingAndBorder(style, dimension) : size;
}

/** Sets the size of the element's content box, like jQuery's width() and height(). */
export function setContentSize(element: HTMLElement, dimension: Dimension, size: number) {
  const style = getComputedStyle(element);
  if (style.boxSizing === 'border-box') {
    size += getPaddingAndBorder(style, dimension);
  }
  element.style[dimension] = `${size}px`;
}

function getPaddingAndBorder(style: CSSStyleDeclaration, dimension: Dimension) {
  const sides = dimension === 'width' ? ['Left', 'Right'] : ['Top', 'Bottom'];
  return sides.reduce(
    (sum, side) =>
      sum +
      parseFloat(style.getPropertyValue(`padding-${side.toLowerCase()}`)) +
      parseFloat(style.getPropertyValue(`border-${side.toLowerCase()}-width`)),
    0,
  );
}
