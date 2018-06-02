declare module 'paper' {
  /**
   * The View object wraps an HTML element and handles drawing and user interaction through mouse and keyboard for it. It offer means to scroll the view, find the currently visible bounds in project coordinates, or the center, both useful for constructing artwork that should appear centered on screen.
   */
  export class View {
    /**
     * The underlying native element.
     * Read Only.
     */
    element: HTMLCanvasElement;

    /**
     * The ratio between physical pixels and device-independent pixels (DIPs) of the underlying canvas / device.
     * It is 1 for normal displays, and 2 or more for high-resolution displays.
     * Read only.
     */
    pixelRatio: number;

    /**
     * The resoltuion of the underlying canvas / device in pixel per inch (DPI).
     * It is 72 for normal displays, and 144 for high-resolution displays with a pixel-ratio of 2.
     * Read only.
     */
    resolution: number;

    /**
     * The size of the view. Changing the view's size will resize it's underlying element.
     */
    viewSize: Size;

    /**
     * The bounds of the currently visible area in project coordinates.
     * Read only.
     */
    bounds: Rectangle;

    /**
     * The size of the visible area in project coordinates.
     * Read only.
     */
    size: Size;

    /**
     * The center of the visible area in project coordinates.
     */
    center: Point;

    /**
     * The zoom factor by which the project coordinates are magnified.
     */
    zoom: number;

    /**
     * The current scale factor of the view, as described by its matrix.
     */
    scaling: Point;

    /**
     * The view’s transformation matrix, defining the view onto the project's
     * contents (position, zoom level, rotation, etc).
     */
    matrix: Matrix;

    /**
     * Handler function to be called on each frame of an animation.
     * The function receives an event object which contains information about the frame event:
     */
    onFrame: (event: FrameEvent) => void;

    /**
     * Handler function that is called whenever a view is resized.
     */
    onResize: (event: Event) => void;

    /**
     * Removes this view from the project and frees the associated element.
     */
    remove(): void;

    /**
     * Checks whether the view is currently visible within the current browser viewport.
     */
    isVisible(): boolean;

    /**
     * Translates (scrolls) the view by the given offset vector.
     * @param delta - the offset to translate the view by
     */
    translate(delta: Point): void;

    /**
     * Makes all animation play by adding the view to the request animation loop.
     */
    play(): void;

    /**
     * Makes all animation pause by removing the view to the request animation loop.
     */
    pause(): void;

    /**
     * Updates the view if there are changes. Note that when using built-in event hanlders for interaction, animation and load events, this method is invoked for you automatically at the end.
     */
    update(): void;

    requestUpdate(): void;

    /**
     *
     * @param point -
     */
    projectToView(point: Point): Point;

    /**
     *
     * @param point -
     */
    viewToProject(point: Point): Point;

    getEventPoint(event: Event): Point;

    /**
     * Attach an event handler to the view.
     * @param type - String('frame'|'resize') the event type
     * @param function - The function to be called when the event occurs
     */
    on(type: string, callback: (event: Event) => void): Item;

    /**
     * Attach one or more event handlers to the view.
     */
    on(param: any): Item;

    /**
     * Detach an event handler from the view.
     * @param type - String('frame'|'resize') the event type
     * @param function - The function to be detached
     */
    off(type: string, callback: (event: Event) => void): Item;

    /**
     * Detach one or more event handlers from the view.
     * @param param -  an object literal containing one or more of the following properties: frame, resize
     */
    off(param: any): Item;

    /**
     * Emit an event on the view.
     * @param type - String('frame'|'resize') the event type
     * @param event - an object literal containing properties describing the event.
     */
    emit(type: string, event: any): boolean;

    /**
     * Check if the view has one or more event handlers of the specified type.
     * @param type - String('frame'|'resize') the event type
     */
    responds(type: string): boolean;
  }
}
