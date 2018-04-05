declare module 'paper' {
  export interface ItemProps {
    /**
     * The tangential vector to the #curve at the given location.
     */
    tangent: Point;

    /**
     * The normal vector to the #curve at the given location.
     */
    normal: Point;

    /**
     * The curvature of the #curve at the given location.
     */
    curvature: number;

    /**
     * The class name of the item as a string.
     */
    className:
      | 'Group'
      | 'Layer'
      | 'Path'
      | 'CompoundPath'
      | 'Shape'
      | 'Raster'
      | 'PlacedSymbol'
      | 'PointText';

    /**
     * The name of the item. If the item has a name, it can be accessed by name through its parent's children list.
     */
    name: string;

    /**
     * The path style of the item.
     */
    style: Style;

    /**
     * Specifies whether the item is visible. When set to false, the item won't be drawn.
     */
    visible: boolean;

    /**
     * The blend mode with which the item is composited onto the canvas. Both the standard canvas
     * compositing modes, as well as the new CSS blend modes are supported. If blend-modes
     * cannot be rendered natively, they are emulated. Be aware that emulation can have an
     * impact on performance.
     */
    blendMode:
      | 'normal'
      | 'multiply'
      | 'screen'
      | 'overlay'
      | 'soft-light'
      | 'hard-light'
      | 'color-dodge'
      | 'color-burn'
      | 'darken'
      | 'lighten'
      | 'difference'
      | 'exclusion'
      | 'hue'
      | 'saturation'
      | 'luminosity'
      | 'color'
      | 'add'
      | 'subtract'
      | 'average'
      | 'pin-light'
      | 'negation'
      | 'source-over'
      | 'source-in'
      | 'source-out'
      | 'source-atop'
      | 'destination-over'
      | 'destination-in'
      | 'destination-out'
      | 'destination-atop'
      | 'lighter'
      | 'darker'
      | 'copy'
      | 'xor';

    /**
     * The opacity of the item as a value between 0 and 1.
     */
    opacity: number;

    /**
     * Specifies whether the item is selected. This will also return true for Group items
     * if they are partially selected, e.g. groups containing selected or partially selected paths.
     * Paper.js draws the visual outlines of selected items on top of your project.
     * This can be useful for debugging, as it allows you to see the construction of paths,
     * position of path curves, individual segment points and bounding boxes of symbol and raster items.
     */
    selected: boolean;

    /**
     * Specifies whether the item defines a clip mask. This can only be set on paths,
     * compound paths, and text frame objects, and only if the item is already contained
     * within a clipping group.
     */
    clipMask: boolean;

    /**
     * A plain javascript object which can be used to store arbitrary data on the item.
     */
    data: { id: string };

    /**
     * The item's position within the parent item's coordinate system. By default, this is
     * the rectangle.center of the item's bounds rectangle.
     */
    position: Point;

    /**
     * The item's pivot point specified in the item coordinate system, defining the point around
     * which all transformations are hinging. This is also the reference point for position.
     * By default, it is set to null, meaning the rectangle.center of the item's bounds rectangle is used as pivot.
     */
    pivot: Point;

    /**
     * The bounding rectangle of the item excluding stroke width.
     */
    bounds: Rectangle;

    /**
     * The bounding rectangle of the item including stroke width.
     */
    strokeBounds: Rectangle;

    /**
     * The bounding rectangle of the item including handles.
     */
    handleBounds: Rectangle;

    /**
     * The current rotation angle of the item, as described by its matrix.
     */
    rotation: number;

    /**
     * The current scale factor of the item, as described by its matrix.
     */
    scaling: Point;

    /**
     * The item's transformation matrix, defining position and dimensions in relation to its
     * parent item in which it is contained.
     */
    matrix: Matrix;

    /**
     * Controls whether the transformations applied to the item (e.g. through transform(matrix),
     * rotate(angle), scale(scale), etc.) are stored in its matrix property, or whether they are
     * directly applied to its contents or children (passed on to the segments in Path items,
     * the children of Group items, etc.).
     */
    applyMatrix: boolean;

    /**
     * The item that this item is contained within.
     */
    parent: Item;

    /**
     * The children items contained within this item. Items that define a name can also be accessed by name.
     * Please note: The children array should not be modified directly using array functions. To remove single items from the children list, use item.remove(), to remove all items from the children list, use item.removeChildren(). To add items to the children list, use item.addChild(item) or item.insertChild(index, item).
     */
    children: Item[];

    /**
     * The first item contained within this item. This is a shortcut for accessing item.children[0].
     */
    firstChild: Item;

    /**
     * The last item contained within this item.This is a shortcut for accessing item.children[item.children.length - 1].
     */
    lastChild: Item;

    /**
     * The color of the stroke.
     */
    strokeColor: Color | string;

    /**
     * The width of the stroke.
     */
    strokeWidth: number;

    /**
     * The shape to be used at the beginning and end of open Path items, when they have a stroke.
     */
    strokeCap: 'round' | 'square' | 'butt';

    /**
     * The shape to be used at the segments and corners of Path items when they have a stroke.
     */
    strokeJoin: 'miter' | 'round' | 'bevel';

    /**
     * The dash offset of the stroke.
     */
    dashOffset: number;

    /**
     * Specifies whether the stroke is to be drawn taking the current affine transformation into account
     * (the default behavior), or whether it should appear as a non-scaling stroke.
     */
    strokeScaling: boolean;

    /**
     * Specifies an array containing the dash and gap lengths of the stroke.
     */
    dashArray: number[];

    /**
     * When two line segments meet at a sharp angle and miter joins have been specified for item.strokeJoin,
     *  it is possible for the miter to extend far beyond the item.strokeWidth of the path.
     * The miterLimit imposes a limit on the ratio of the miter length to the item.strokeWidth.
     */
    miterLimit: number;

    /**
     * The winding-rule with which the shape gets filled. Please note that only modern browsers
     * support winding-rules other than 'nonzero'.
     */
    windingRule: 'nonzero' | 'evenodd';

    /**
     * The fill color of the item.
     */
    fillColor: Color | string;

    /**
     * The fill rule.
     */
    fillRule: string;

    /**
     * The color the item is highlighted with when selected. If the item does not specify its own color, the color defined by its layer is used instead.
     */
    selectedColor: Color | string;

    guide: boolean;

    fullySelected: boolean;
  }

  export interface Item extends ItemProps {}

  /**
   * The Item type allows you to access and modify the items in Paper.js projects.
   * Its functionality is inherited by different project item types such as Path,
   * CompoundPath, Group, Layer and Raster. They each add a layer of functionality
   * that is unique to their type, but share the underlying properties and
   * functions that they inherit from Item.
   */
  export abstract class Item {
    /**
     * The unique id of the item.
     */
    readonly id: number;

    /**
     * The project that this item belongs to.
     */
    readonly project: Project;

    /**
     * The view that this item belongs to.
     */
    readonly view: View;

    /**
     * The layer that this item is contained within.
     */
    readonly layer: Layer;

    /**
     * The next item on the same level as this item.
     */
    readonly nextSibling: Item;

    /**
     * The previous item on the same level as this item.
     */
    readonly previousSibling: Item;

    /**
     * The index of this item within the list of its parent's children.
     */
    readonly index: number;

    /**
     * The item's global transformation matrix in relation to the global project coordinate space.
     * Note that the view's transformations resulting from zooming and panning are not factored in.
     */
    readonly globalMatrix: Matrix;

    /**
     * The item’s global matrix in relation to the view coordinate space. This means that
     * the view’s transformations resulting from zooming and panning are factored in.
     */
    readonly viewMatrix: Matrix;

    /**
     * Item level handler function to be called on each frame of an animation.
     * The function receives an event object which contains information about the frame event:
     */
    onFrame: (event: FrameEvent) => void;

    /**
     * The function to be called when the mouse button is pushed down on the item. The function receives a MouseEvent object which contains information about the mouse event.
     */
    onMouseDown: (event: MouseEvent) => void;

    /**
     * The function to be called when the mouse button is released over the item.
     * The function receives a MouseEvent object which contains information about the mouse event.
     */
    onMouseUp: (event: MouseEvent) => void;

    /**
     * The function to be called when the mouse clicks on the item. The function receives a MouseEvent object which contains information about the mouse event.
     */
    onClick: (event: MouseEvent) => void;

    /**
     * The function to be called when the mouse double clicks on the item. The function receives a MouseEvent object which contains information about the mouse event.
     */
    onDoubleClick: (event: MouseEvent) => void;

    /**
     * The function to be called repeatedly when the mouse moves on top of the item. The function receives a MouseEvent object which contains information about the mouse event.
     */
    onMouseMove: (event: MouseEvent) => void;

    /**
     * The function to be called when the mouse moves over the item. This function will only be called again, once the mouse moved outside of the item first. The function receives a MouseEvent object which contains information about the mouse event.
     */
    onMouseEnter: (event: MouseEvent) => void;

    /**
     * The function to be called when the mouse moves out of the item.
     * The function receives a MouseEvent object which contains information about the mouse event.
     */
    onMouseLeave: (event: MouseEvent) => void;

    /**
     * Sets those properties of the passed object literal on this item to the values defined in the object literal, if the item has property of the given name (or a setter defined for it).
     */
    set(props: any): Item;

    /**
     * Clones the item within the same project and places the copy above the item.
     * @param insert [optional] - specifies whether the copy should be inserted into the DOM. When set to true, it is inserted above the original. default: true
     */
    clone(insert?: boolean): Item;

    /**
     * When passed a project, copies the item to the project, or duplicates it within the same project. When passed an item, copies the item into the specified item.
     * @param item - the item or project to copy the item to
     */
    copyTo(item: Item): Item;

    /**
     * Rasterizes the item into a newly created Raster object. The item itself is not removed after rasterization.
     * @param resolution [optional] - the resolution of the raster in pixels per inch (DPI). If not specified, the value of view.resolution is used. default: view.resolution
     */
    rasterize(resolution: number): Raster;

    /**
     * Checks whether the item's geometry contains the given point.
     * @param point - The point to check for.
     */
    contains(point: Point): boolean;

    /**
     *
     * @param rect - the rectangle to check against
     */
    isInside(rect: Rectangle): boolean;

    /**
     *
     * @param item - the item to check against
     */
    intersects(item: Item): boolean;

    /**
     * Perform a hit-test on the items contained within the project at the
     * location of the specified point. The options object allows you to control
     * the specifics of the hit-test and may contain a combination of the following values:
     * @param point - the point where the hit-test should be performed
     * @param options.tolerance -the tolerance of the hit-test in points.
     * Can also be controlled through paperScope.settings.hitTolerance
     * @param options.class - only hit-test again a certain item class and its sub-classes:
     * Group, Layer, Path, CompoundPath, Shape, Raster, PlacedSymbol, PointText, etc.
     * @param options.fill - hit-test the fill of items.
     * @param options.stroke - hit-test the stroke of path items, taking into
     * account the setting of stroke color and width.
     * @param options.segments - hit-test for segment.point of Path items.
     * @param options.curves - hit-test the curves of path items, without
     * taking the stroke color or width into account.
     * @param options.handles - hit-test for the handles.
     * (segment.handleIn / segment.handleOut) of path segments.
     * @param options.ends - only hit-test for the first or last segment points
     * of open path items.
     * @param options.bounds - hit-test the corners and side-centers of the
     * bounding rectangle of items (item.bounds).
     * @param options.center - hit-test the rectangle.center of the bounding
     * rectangle of items (item.bounds).
     * @param options.guides - hit-test items that have Item#guide set to true.
     * @param options.selected - only hit selected items.
     */
    hitTest<C extends Item = Item>(point: Point, options?: HitOptions<C>): HitResult<C>;

    /**
     * Performs a hit-test on the item and its children (if it is a Group or Layer)
     * at the location of the specified point, returning all found hits.
     *
     * The options object allows you to control the specifics of the hit- test.
     * See hitTest(point[, options]) for a list of all options.
     *
     * @param point - the point where the hit-test should be performed
     * @param options: Object — optional,
     * default: { fill: true, stroke: true, segments: true, tolerance: settings.hitTolerance }
     */
    hitTestAll<C extends Item = Item>(point: Point, options?: HitOptions<C>): HitResult<C>[];

    /**
     * Checks whether the item matches the criteria described by the given object, by iterating
     * over all of its properties and matching against their values through matches(name, compare).
     * See project.getItems(match) for a selection of illustrated examples.
     * @param match - the criteria to match against.
     */
    matches(match: any): boolean;

    /**
     * Checks whether the item matches the given criteria. Extended matching is possible by providing
     * a compare function or a regular expression.
     * Matching points, colors only work as a comparison of the full object, not partial matching (e.g.
     * only providing the x-coordinate to match all points with that x-value). Partial matching does
     * work for item.data.
     * @param name - the name of the state to match against.
     * @param compare - the value, function or regular expression to compare against.
     */
    matches(name: string, compare: any): boolean;

    /**
     * Fetch the descendants (children or children of children) of this item that match the
     * properties in the specified object.
     * Extended matching is possible by providing a compare function or regular expression.
     * Matching points, colors only work as a comparison of the full object, not
     * partial matching (e.g. only providing the x- coordinate to match all points with
     * that x-value). Partial matching does work for item.data.
     * Matching items against a rectangular area is also possible, by setting either
     * match.inside or match.overlapping to a rectangle describing the area in which
     * the items either have to be fully or partly contained.
     * @param match.inside - the rectangle in which the items need to be fully contained.
     * @param match.overlapping - the rectangle with which the items need to at least partly overlap.
     */
    getItems(matchFn?: (item: Item) => boolean): Item[];
    getItems<C extends Item = Item>(options?: GetItemsOptions<C>): C[];

    /**
     * Fetch the first descendant (child or child of child) of this item that matches the properties in the specified object.
     * Extended matching is possible by providing a compare function or regular expression. Matching points, colors only work as a comparison of the full object, not partial matching (e.g. only providing the x- coordinate to match all points with that x-value). Partial matching does work for item.data.
     * @param match - the criteria to match against
     */
    getItem(matchFn?: (item: Item) => boolean): Item;
    getItem<T extends Partial<ItemProps>>(object?: { [P in keyof T]: T[P] }): Item;

    /**
     * Exports (serializes) the project with all its layers and child items to a JSON data string.
     * @param options [optional] - default {asString: true, precision: 5}
     * @param options.asString - whether the JSON is returned as a Object or a String.
     * @param options.precision - the amount of fractional digits in numbers used in JSON data.
     */
    exportJSON(options?: { asString?: boolean; precision?: number }): string;

    /**
     * Imports (deserializes) the stored JSON data into the project.
     * Note that the project is not cleared first. You can call project.clear() to do so.
     */
    importJSON(json: string): void;

    /**
     * Exports the project with all its layers and child items as an SVG DOM, all contained in one top level SVG group node.
     * @param options [optional] the export options, default: { asString: false, precision: 5, matchShapes: false }
     * @param options.asString - whether a SVG node or a String is to be returned.
     * @param options.precision - the amount of fractional digits in numbers used in SVG data.
     * @param options.matchShapes - whether path items should tried to be converted to shape items, if their geometries can be made to match
     */
    exportSVG(options?: {
      asString?: boolean;
      precision?: number;
      matchShapes?: boolean;
    }): SVGElement;

    /**
     * Converts the provided SVG content into Paper.js items and adds them to the active layer of this project.
     * Note that the project is not cleared first. You can call project.clear() to do so.
     * @param svg - the SVG content to import
     * @param options [optional] - the import options, default: { expandShapes: false }
     * @param options.expandShapes - whether imported shape items should be expanded to path items.
     */
    importSVG(svg: SVGElement | string, options?: any): Item;

    /**
     * Adds the specified item as a child of this item at the end of the its children list. You can use this function for groups, compound paths and layers.
     * @param item - the item to add as a child
     */
    addChild(item: Item): Item;

    /**
     * Inserts the specified item as a child of this item at the specified index in its children list. You can use this function for groups, compound paths and layers.
     * @param index - the index
     * @param item - the item to be inserted as a child
     */
    insertChild(index: number, item: Item): Item;

    /**
     * Adds the specified items as children of this item at the end of the its children list. You can use this function for groups, compound paths and layers.
     * @param items - The items to be added as children
     */
    addChildren(items: Item[]): Item[];

    /**
     * Inserts the specified items as children of this item at the specified index in its children list. You can use this function for groups, compound paths and layers.
     * @param index -
     * @param items - The items to be appended as children
     */
    insertChildren(index: number, items: Item[]): Item[];

    /**
     * Inserts this item above the specified item.
     * @param item - the item above which it should be inserted
     */
    insertAbove(item: Item): Item;

    /**
     * Inserts this item below the specified item.
     * @param item - the item below which it should be inserted
     */
    insertBelow(item: Item): Item;

    /**
     * Moves this item above the specified item. Returns true if the item
     * was moved.
     * @param item - the item above which it should be moved
     */
    moveAbove(item: Item): boolean;

    /**
     * Moves this item below the specified item. Returns true if the item
     * was moved.
     * @param item - the item below which it should be moved
     */
    moveBelow(item: Item): boolean;

    /**
     * Sends this item to the back of all other items within the same parent.
     */
    sendToBack(): void;

    /**
     * Brings this item to the front of all other items within the same parent.
     */
    bringToFront(): void;

    /**
     * If this is a group, layer or compound-path with only one child-item, the child-item is moved outside and the parent is erased. Otherwise, the item itself is returned unmodified.
     */
    reduce(): Item;

    /**
     * Removes the item and all its children from the project. The item is not destroyed and can be inserted again after removal.
     */
    remove(): boolean;

    /**
     * Replaces this item with the provided new item which will takes its place in the project hierarchy instead.
     * @param item - the item to replace this one with
     */
    replaceWith(item: Item): boolean;

    /**
     * Removes all of the item's children (if any).
     */
    removeChildren(): Item[];

    /**
     * Removes the children from the specified from index to the to index from the parent's children array.
     * @param from - the beginning index, inclusive
     * @param to [optional] - the ending index, exclusive, default: children.length
     */
    removeChildren(from: number, to?: number): Item[];

    /**
     * Reverses the order of the item's children
     */
    reverseChildren(): void;

    /**
     * Specifies whether the item has any content or not. The meaning of what content is differs from type to type. For example, a Group with no children, a TextItem with no text content and a Path with no segments all are considered empty.
     */
    isEmpty(): boolean;

    /**
     * Checks whether the item has a fill.
     */
    hasFill(): boolean;

    /**
     * Checks whether the item has a stroke.
     */
    hasStroke(): boolean;

    /**
     * Checks whether the item has a shadow.
     */
    hasShadow(): boolean;

    /**
     * Checks if the item contains any children items.
     */
    hasChildren(): boolean;

    /**
     * Checks whether the item and all its parents are inserted into the DOM or not.
     */
    isInserted(): boolean;

    /**
     * Checks if this item is above the specified item in the stacking order of the project.
     * @param item - The item to check against
     */
    isAbove(item: Item): boolean;

    /**
     * Checks if the item is below the specified item in the stacking order of the project.
     * @param item - The item to check against
     */
    isBelow(item: Item): boolean;

    /**
     * Checks whether the specified item is the parent of the item.
     * @param item - The item to check against
     */
    isParent(item: Item): boolean;

    /**
     * Checks whether the specified item is a child of the item.
     * @param item - The item to check against
     */
    isChild(item: Item): boolean;

    /**
     * Checks if the item is contained within the specified item.
     * @param item - The item to check against
     */
    isDescendant(item: Item): boolean;

    /**
     * Checks if the item is an ancestor of the specified item.
     * @param item - the item to check against
     */
    isAncestor(item: Item): boolean;

    /**
     * Checks whether the item is grouped with the specified item.
     * @param item -
     */
    isGroupedWith(item: Item): boolean;

    /**
     * Translates (moves) the item by the given offset point.
     * @param delta - the offset to translate the item by
     */
    translate(delta: Point): Point;

    /**
     * Rotates the item by a given angle around the given point.
     * Angles are oriented clockwise and measured in degrees.
     * @param angle - the rotation angle
     * @param center [optional] - default: item.position
     */
    rotate(angle: number, center?: Point): void;

    /**
     * Gets the current rotation of the item.
     */
    getRotation(): number;

    /**
     * Scales the item by the given value from its center point, or optionally from a supplied point.
     * @param scale - the scale factor
     * @param center [optional] - default: item.position
     */
    scale(scale: number, center?: Point): void;

    /**
     * Scales the item by the given values from its center point, or optionally from a supplied point.
     * @param hor - the horizontal scale factor
     * @param ver - the vertical scale factor
     * @param center [optional] - default: item.position
     */
    scale(hor: number, ver: number, center?: Point): void;

    /**
     * Shears the item by the given value from its center point, or optionally by a supplied point.
     * @param shear - the horziontal and vertical shear factors as a point
     * @param center [optional] - default: item.position
     */
    shear(shear: number, center?: Point): void;

    /**
     * Shears the item by the given values from its center point, or optionally by a supplied point.
     * @param hor - the horizontal shear factor
     * @param ver - the vertical shear factor
     * @param center [optional] - default: item.position
     */
    shear(hor: number, ver: number, center?: Point): void;

    /**
     * Skews the item by the given angles from its center point, or optionally by a supplied point.
     * @param skew - the horziontal and vertical skew angles in degrees
     * @param center [optional] - default: item.position
     */
    skew(skew: Point, center?: Point): void;

    /**
     * Skews the item by the given angles from its center point, or optionally by a supplied point.
     * @param hor - the horizontal skew angle in degrees
     * @param ver - the vertical sskew angle in degrees
     * @param center [optional] - default: item.position
     */
    skew(hor: number, ver: number, center?: Point): void;

    /**
     * Transform the item.
     * @param matrix - the matrix by which the item shall be transformed.
     */
    transform(matrix: Matrix): void;

    /**
     * Converts the specified point from global project coordinate space to the item's own local coordinate space.
     * @param point - the point to be transformed
     */
    globalToLocal(point: Point): Point;

    /**
     * Converts the specified point from the item's own local coordinate space to the global project coordinate space.
     * @param point - the point to be transformed
     */
    localToGlobal(point: Point): Point;

    /**
     * Converts the specified point from the parent's coordinate space to item's own local coordinate space.
     * @param point - the point to be transformed
     */
    parentToLocal(point: Point): Point;

    /**
     * Converts the specified point from the item's own local coordinate space to the parent's coordinate space.
     * @param point - the point to be transformed
     */
    localToParent(point: Point): Point;

    /**
     * Transform the item so that its bounds fit within the specified rectangle, without changing its aspect ratio.
     * @param rectangle -
     * @param fill [optiona;] - default = false
     */
    fitBounds(rectangle: Rectangle, fill?: boolean): void;

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
    responds(type: string): boolean; //I cannot use function: Function as it is a reserved keyword

    /**
     * Attaches an event handler to the item.
     * @param type - String('mousedown'|'mouseup'|'mousedrag'|'mousemove'|'keydown'|'keyup') the event type
     * @param function - The function to be called when the event occurs
     */
    on(type: string, callback: () => void): Item;

    /**
     * Attaches one or more event handlers to the item.
     * @param param - an object literal containing one or more of the following properties: mousedown, mouseup, mousedrag, mousemove, keydown, keyup
     */
    on(param: any): Item;

    /**
     * Detach an event handler from the item.
     * @param type - String('mousedown'|'mouseup'|'mousedrag'|'mousemove'|'keydown'|'keyup') the event type
     * @param function - The function to be detached
     */
    off(type: string, callback: (event: ToolEvent) => void): Item;

    /**
     * Detach one or more event handlers to the item.
     * @param param -  an object literal containing one or more of the following properties: mousedown, mouseup, mousedrag, mousemove, keydown, keyup
     */
    off(param: any): Item;

    /**
     * Emit an event on the item.
     * @param type - String('mousedown'|'mouseup'|'mousedrag'|'mousemove'|'keydown'|'keyup') the event type
     * @param event - an object literal containing properties describing the event.
     */
    emit(type: string, event: any): boolean;

    /**
     * Check if the item has one or more event handlers of the specified type..
     * @param type - String('mousedown'|'mouseup'|'mousedrag'|'mousemove'|'keydown'|'keyup') the event type
     */
    responds(type: string): boolean;

    /**
     * Removes the item when the events specified in the passed object literal occur.
     * @param object - The object literal can contain the following values
     * @param object.move - Remove the item when the next tool.onMouseMove event is fired
     * @param object.drag - Remove the item when the next tool.onMouseDrag event is fired
     * @param object.down - Remove the item when the next tool.onMouseDown event is fired
     * @param object.up - Remove the item when the next tool.onMouseUp event is fired
     */
    removeOn(object: { move?: boolean; drag?: boolean; down?: boolean; up?: boolean }): void;

    /**
     * Removes the item when the next tool.onMouseMove event is fired.
     */
    removeOnMove(): void;

    /**
     * Removes the item when the next tool.onMouseDown event is fired.
     */
    removeOnDown(): void;

    /**
     * Removes the item when the next tool.onMouseDrag event is fired.
     */
    removeOnDrag(): void;

    /**
     * Removes the item when the next tool.onMouseUp event is fired.
     */
    removeOnUp(): void;

    equals(item: Item): boolean;
  }

  export interface GetItemsOptions<C extends Item> {
    recursive?: boolean;
    match?: (item: C) => boolean;
    class?: Constructor<C>;
    inside?: Rectangle;
    overlapping?: Rectangle;
  }
}
