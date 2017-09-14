declare module 'paper' {
  /**
   * A Project object in Paper.js is what usually is referred to as the document: The top level object that holds all the items contained in the scene graph. As the term document is already taken in the browser context, it is called Project.
   * Projects allow the manipulation of the styles that are applied to all newly created items, give access to the selected items, and will in future versions offer ways to query for items in the scene graph defining specific requirements, and means to persist and load from different formats, such as SVG and PDF.
   * The currently active project can be accessed through the paperScope.project variable.
   * An array of all open projects is accessible through the paperScope.projects variable.
   */
  export class Project {
    /**
     * Creates a Paper.js project containing one empty Layer, referenced by project.activeLayer.
     * @param element - the HTML canvas element that should be used as the element for the view, or an ID string by which to find the element.
     */
    constructor(element: HTMLCanvasElement | string);

    /**
     * The reference to the project's view.
     * Read only.
     */
    view: View;

    /**
     * The currently active path style. All selected items and newly created items will be styled with this style.
     */
    currentStyle: Style;

    /**
     * The index of the project in the paperScope.projects list.
     * Read Only
     */
    index: number;

    /**
     * The layers contained within the project.
     */
    layers: Layer[];

    /**
     * The layer which is currently active. New items will be created on this layer by default.
     * Read Only.
     */
    activeLayer: Layer;

    /**
     * The symbols contained within the project.
     */
    symbols: Symbol[];

    selectedItems: Item[];

    /**
     * Activates this project, so all newly created items will be placed in it.
     */
    activate(): void;

    /**
     * Clears the project by removing all project.layers and project.symbols.
     */
    clear(): void;

    /**
     * Checks whether the project has any content or not.
     */
    isEmpty(): boolean;

    /**
     * Removes this project from the paperScope.projects list, and also removes its view, if one was defined.
     */
    remove(): void;

    /**
     * Selects all items in the project.
     */
    selectAll(): void;

    /**
     * Deselects all selected items in the project.
     */
    deselectAll(): void;

    /**
     * Perform a hit-test on the items contained within the project at
     * the location of the specified point.
     * The options object allows you to control the specifics of the
     * hit-test and may contain a combination of the following values:
     * @param point - the point where the hit-test should be performed
     * @param options.tolerance -the tolerance of the hit-test in points.
     * Can also be controlled through paperScope.settings.hitTolerance
     * @param options.class - only hit-test again a certain item class
     * and its sub-classes:
     * Group, Layer, Path, CompoundPath, Shape, Raster, PlacedSymbol, PointText, etc.
     * @param options.fill - hit-test the fill of items.
     * @param options.stroke - hit-test the stroke of path items,
     * taking into account the setting of stroke color and width.
     * @param options.segments - hit-test for segment.point of Path items.
     * @param options.curves - hit-test the curves of path items, without
     * taking the stroke color or width into account.
     * @param options.handles - hit-test for the handles. (segment.handleIn / segment.handleOut) of path segments.
     * @param options.ends - only hit-test for the first or last segment points of open path items.
     * @param options.bounds - hit-test the corners and side-centers of the bounding rectangle of items (item.bounds).
     * @param options.center - hit-test the rectangle.center of the bounding rectangle of items (item.bounds).
     * @param options.guides - hit-test items that have Item#guide set to true.
     * @param options.selected - only hit selected items.
     */
    hitTest<C extends Item = Item>(point: Point, options?: HitOptions<C>): HitResult<C>;

    /**
     * Fetch items contained within the project whose properties match the criteria
     * in the specified object.
     * Extended matching is possible by providing a compare function or regular expression.
     * Matching points, colors only work as a comparison of the full object, not partial
     * matching (e.g. only providing the x- coordinate to match all points with that x-value).
     * Partial matching does work for item.data.
     * Matching items against a rectangular area is also possible, by setting either
     * match.inside or match.overlapping to a rectangle describing the area in which
     * the items either have to be fully or partly contained.
     */
    getItems(match: any): Item[];

    /**
     * Fetch the first item contained within the project whose properties match the
     * criteria in the specified object.
     * Extended matching is possible by providing a compare function or regular
     * expression. Matching points, colors only work as a comparison of the full
     * object, not partial matching (e.g. only providing the x- coordinate to
     * match all points with that x-value). Partial matching does work for item.data.
     */
    getItem(match: any): Item;

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

    addLayer(layer: Layer): Layer | null;
  }
}
