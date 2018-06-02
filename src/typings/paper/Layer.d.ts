declare module 'paper' {
  export interface LayerProps extends GroupProps {}

  export interface Layer extends LayerProps {}

  /**
   * The Layer item represents a layer in a Paper.js project.
   * The layer which is currently active can be accessed through project.activeLayer.
   * An array of all layers in a project can be accessed through project.layers.
   */
  export class Layer extends Group {
    /**
     * Creates a new Layer item and places it at the end of the project.layers array. The newly created layer will be activated, so all newly created items will be placed within it.
     * @param children [optional] - An array of Items that will be added to the newly created layer.
     */
    constructor(children?: Item[]);
    /**
     * Creates a new Layer item and places it at the end of the project.layers array. The newly created layer will be activated, so all newly created items will be placed within it.
     * @param object [optional] - an object literal containing the properties to be set on the layer.
     */
    constructor(object?: Partial<LayerProps>);

    /**
     * Activates the layer.
     */
    activate(): void;
  }
}
