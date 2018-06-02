declare module 'paper' {
  export interface GroupProps extends ItemProps {
    /**
     * Specifies whether the group item is to be clipped.
     * When setting to true, the first child in the group is automatically defined as the clipping mask.
     */
    clipped: boolean;
  }

  export interface Group extends GroupProps {}

  /**
   * A Group is a collection of items. When you transform a Group, its children are treated as a single unit without changing their relative positions.
   */
  export class Group extends Item {
    /**
     * Creates a new Group item and places it at the top of the active layer.
     * @param children [optional] - An array of Item Objects children that will be added to the newly created group.
     */
    constructor(children?: Item[]);

    /**
     * Creates a new Group item and places it at the top of the active layer.
     * @param object [optional] - an object literal containing the properties to be set on the group.
     */
    constructor(object?: Partial<GroupProps>);
  }
}
