declare module 'paper' {
  /**
   * A PlacedSymbol represents an instance of a symbol which has been placed in a Paper.js project.
   */
  export class PlacedSymbol extends Item {
    /**
     * Creates a new PlacedSymbol Item.
     * @param symbol - the symbol to place
     * @param point [optional] - the center point of the placed symbol
     */
    constructor(symbol: Symbol, point?: Point);

    /**
     * The symbol that the placed symbol refers to.
     */
    symbol: Symbol;
  }
}
