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

/**
 * Returns the position of the element's margin box relative to its offset parent's padding
 * box, like jQuery's position(). Unlike offsetLeft and offsetTop, this changes as the element's
 * ancestors scroll.
 */
export function getPosition(element: HTMLElement) {
  const offsetParent = (element.offsetParent as HTMLElement) || document.documentElement;
  const rect = element.getBoundingClientRect();
  const parentRect = offsetParent.getBoundingClientRect();
  const style = getComputedStyle(element);
  const parentStyle = getComputedStyle(offsetParent);
  return {
    left:
      rect.left -
      parentRect.left -
      parseFloat(parentStyle.borderLeftWidth) -
      parseFloat(style.marginLeft),
    top:
      rect.top -
      parentRect.top -
      parseFloat(parentStyle.borderTopWidth) -
      parseFloat(style.marginTop),
  };
}

/** Returns whether the element is rendered, like jQuery's is(':visible'). */
export function isVisible(element: HTMLElement) {
  return !!(element.offsetWidth || element.offsetHeight || element.getClientRects().length);
}

/** Returns the canvas's 2D context. It's only null if the canvas already has another kind. */
export function getContext2d(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error("Couldn't get the canvas's 2D context");
  }
  return ctx;
}

// Browsers fail to draw canvases that are larger than this (and Firefox throws).
const MAX_CANVAS_SIZE = 16384;

/**
 * Returns the number of canvas pixels per CSS pixel to draw a canvas of the given CSS size at.
 * That's the device pixel ratio, unless the canvas would then be too big to draw, e.g. when
 * zoomed in on a long animation.
 */
export function getCanvasPixelRatio(width: number, height: number) {
  return Math.min(devicePixelRatio, MAX_CANVAS_SIZE / width, MAX_CANVAS_SIZE / height);
}
