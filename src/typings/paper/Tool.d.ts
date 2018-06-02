declare module 'paper' {
  /**
   * The Tool object refers to a script that the user can interact with by using the mouse and keyboard and can be accessed through the global tool variable. All its properties are also available in the paper scope.
   * The global tool variable only exists in scripts that contain mouse handler functions (onMouseMove, onMouseDown, onMouseDrag, onMouseUp) or a keyboard handler function (onKeyDown, onKeyUp).
   */
  export class Tool {
    /**
     * The minimum distance the mouse has to drag before firing the onMouseDrag event, since the last onMouseDrag event.
     */
    minDistance: number;

    /**
     * The maximum distance the mouse has to drag before firing the onMouseDrag event, since the last onMouseDrag event.
     */
    maxDistance: number;

    /**
     *
     */
    fixedDistance: number;

    /**
     * The function to be called when the mouse button is pushed down. The function receives a ToolEvent object which contains information about the mouse event.
     */
    onMouseDown: (event: ToolEvent) => void;

    /**
     * The function to be called when the mouse position changes while the mouse is being dragged. The function receives a ToolEvent object which contains information about the mouse event.
     */
    onMouseDrag: (event: ToolEvent) => void;

    /**
     * The function to be called the mouse moves within the project view. The function receives a ToolEvent object which contains information about the mouse event.
     */
    onMouseMove: (event: ToolEvent) => void;

    /**
     * The function to be called when the mouse button is released. The function receives a ToolEvent object which contains information about the mouse event.
     */
    onMouseUp: (event: ToolEvent) => void;

    /**
     * The function to be called when the user presses a key on the keyboard.
     * The function receives a KeyEvent object which contains information about the keyboard event.
     * If the function returns false, the keyboard event will be prevented from bubbling up. This can be used for example to stop the window from scrolling, when you need the user to interact with arrow keys.
     */
    onKeyDown: (event: KeyEvent) => void;

    /**
     * The function to be called when the user releases a key on the keyboard.
     * The function receives a KeyEvent object which contains information about the keyboard event.
     * If the function returns false, the keyboard event will be prevented from bubbling up. This can be used for example to stop the window from scrolling, when you need the user to interact with arrow keys.
     */
    onKeyUp: (event: KeyEvent) => void;

    /**
     * Activates this tool, meaning paperScope.tool will point to it and it will be the one that recieves mouse events.
     */
    activate(): void;

    /**
     * Removes this tool from the paperScope.tools list.
     */
    remove(): void;

    //I cannot use function: Function as it is a reserved keyword

    /**
     * Attach an event handler to the tool.
     * @param type - String('mousedown'|'mouseup'|'mousedrag'|'mousemove'|'keydown'|'keyup') the event type
     * @param function - The function to be called when the event occurs
     */
    on(type: string, callback: (event: ToolEvent) => void): Tool;

    /**
     * Attach one or more event handlers to the tool.
     * @param param - an object literal containing one or more of the following properties: mousedown, mouseup, mousedrag, mousemove, keydown, keyup
     */
    on(param: any): Tool;

    /**
     * Detach an event handler from the tool.
     * @param type - String('mousedown'|'mouseup'|'mousedrag'|'mousemove'|'keydown'|'keyup') the event type
     * @param function - The function to be detached
     */
    off(type: string, callback: (event: ToolEvent) => void): Tool;

    /**
     * Detach one or more event handlers from the tool.
     * @param param -  an object literal containing one or more of the following properties: mousedown, mouseup, mousedrag, mousemove, keydown, keyup
     */
    off(param: any): Tool;

    /**
     * Emit an event on the tool.
     * @param type - String('mousedown'|'mouseup'|'mousedrag'|'mousemove'|'keydown'|'keyup') the event type
     * @param event - an object literal containing properties describing the event.
     */
    emit(type: string, event: any): boolean;

    /**
     * Check if the tool has one or more event handlers of the specified type.
     * @param type - String('mousedown'|'mouseup'|'mousedrag'|'mousemove'|'keydown'|'keyup') the event type
     */
    responds(type: string): boolean;
  }
}
