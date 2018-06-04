type NativeMouseEvent = MouseEvent;

declare module 'paper' {
  export class Event {
    readonly modifiers: {
      readonly shift: boolean;
      readonly control: boolean;
      readonly alt: boolean;
      readonly meta: boolean;
      readonly capsLock: boolean;
      readonly space: boolean;
      readonly option: boolean;
      readonly command: boolean;
    };

    readonly timeStamp: number;

    /**
     * Cancels the event if it is cancelable, without stopping further
     * propagation of the event.
     */
    preventDefault(): void;

    /**
     * Cancels the event if it is cancelable, and stops stopping further
     * propagation of the event. This is has the same effect as calling both
     * stopPropagation() and preventDefault().
     *
     * Any handler can also return false to indicate that stop() should be
     * called right after.
     */
    stop(): void;

    /** Prevents further propagation of the current event. */
    stopPropagation(): void;
  }

  /**
   * ToolEvent The ToolEvent object is received by the Tool's mouse event handlers
   * tool.onMouseDown, tool.onMouseDrag, tool.onMouseMove and tool.onMouseUp.
   * The ToolEvent object is the only parameter passed to these functions and
   * contains information about the mouse event.
   */
  export class ToolEvent extends Event {
    /**
     * The type of tool event.
     * String('mousedown', 'mouseup', 'mousemove', 'mousedrag')
     */
    type: 'mousedown' | 'mouseup' | 'mousemove' | 'mousedrag';

    /**
     * The position of the mouse in project coordinates when the event was fired.
     */
    point: Point;

    /**
     * The position of the mouse in project coordinates when the previous event was fired.
     */
    lastPoint: Point;

    /**
     * The position of the mouse in project coordinates when the mouse button was last clicked.
     */
    downPoint: Point;

    /**
     * The point in the middle between lastPoint and point. This is a useful position to use when creating artwork based on the moving direction of the mouse, as returned by delta.
     */
    middlePoint: Point;

    /**
     * The difference between the current position and the last position of the mouse when the event was fired. In case of the mouseup event, the difference to the mousedown position is returned.
     */
    delta: Point;

    /**
     * The number of times the mouse event was fired.
     */
    count: number;

    /**
     * The item at the position of the mouse (if any). If the item is contained within one or more Group or CompoundPath items, the most top level group or compound path that it is contained within is returned.
     */
    item: Item;

    /**
     * a string representation of the tool event
     */
    toString(): string;
  }

  export class Key {
    /**
     * Checks whether the specified key is pressed.
     * @param key - One of: 'backspace', 'enter', 'shift', 'control', 'option', 'pause', 'caps-lock', 'escape', 'space', 'end', 'home', 'left', 'up', 'right', 'down', 'delete', 'command'
     */
    static isDown(key: string): boolean;
  }

  /**
   * The KeyEvent object is received by the Tool's keyboard handlers tool.onKeyDown, tool.onKeyUp. The KeyEvent object is the only parameter passed to these functions and contains information about the keyboard event.
   */
  export class KeyEvent extends Event {
    /**
     * The type of key event.
     * String('keydown', 'keyup')
     */
    type: 'keydown' | 'keyup';

    /**
     * The string character of the key that caused this key event.
     */
    character: string;

    /**
     * The key that caused this key event.
     */
    key: string;

    /**
     * a string representation of the key event
     */
    toString(): string;
  }

  export interface FrameEvent {
    /**
     * the number of times the frame event was fired.
     */
    count: number;

    /**
     * the total amount of time passed since the first
     */
    time: number;

    delta: number;
  }

  /**
   * A Javascript MouseEvent wrapper
   */
  export class MouseEvent extends Event {
    constructor(type: string, event: NativeMouseEvent, point: Point, target: Item, delta: Point);

    /**
     * The JavaScript mouse event
     */
    event: NativeMouseEvent;

    /**
     * The position of the mouse in project coordinates when the event was
     * fired.
     */
    point: Point;

    /**
     * The last event's position of the mouse in project coordinates when
     * the event was fired.
     */
    lastPoint: Point;

    delta: Point;

    /**
     * The item that dispatched the event. It is different from
     * currentTarget when the event handler is called during the bubbling
     * phase of the event.
     */
    target: Item;

    /**
     * The current target for the event, as the event traverses the scene
     * graph. It always refers to the element the event handler has been
     * attached to as opposed to target which identifies the element on
     * which the event occurred.
     */
    currentTarget: Item;

    /**
     * Type of mouse event
     */
    type:
      | 'mousedown'
      | 'mouseup'
      | 'mousedrag'
      | 'click'
      | 'doubleclick'
      | 'mousemove'
      | 'mouseenter'
      | 'mouseleave';

    /**
     * Cancels the event if it is cancelable, without stopping further
     * propagation of the event.
     */
    preventDefault(): void;

    /**
     * Prevents further propagation of the current event.
     */
    stopPropagation(): void;

    /**
     * Cancels the event if it is cancelable, and stops stopping further
     * propagation of the event. This is has the same effect as calling
     * both stopPropagation() and preventDefault().
     *
     * Any handler can also return false to indicate that stop() should be
     * called right after.
     */
    stop(): void;
  }
}
