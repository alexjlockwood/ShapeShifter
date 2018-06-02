declare module 'paper' {
  /**
   * Symbols allow you to place multiple instances of an item in your project.
   * This can save memory, since all instances of a symbol simply refer to the
   * original item and it can speed up moving around complex objects, since internal
   * properties such as segment lists and gradient positions don't need to be
   * updated with every transformation.
   */
  export class Symbol {
    /**
     * Creates a Symbol item.
     * @param item - the source item which is copied as the definition of the symbol
     * @param dontCenter [optional] - default: false
     */
    constructor(item: Item, dontCenter?: boolean);

    /**
     * The project that this symbol belongs to.
     */
    readonly project: Project;

    /**
     * The symbol definition.
     */
    definition: Item;

    /**
     * Places in instance of the symbol in the project.
     * @param position [optional] - The position of the placed symbol.
     */
    place(position?: Point): PlacedSymbol;

    /**
     * Returns a copy of the symbol.
     */
    clone(): Symbol;
  }
}
