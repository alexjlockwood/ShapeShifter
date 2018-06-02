declare module 'paper' {
  /**
   * The TextItem type allows you to create typography. Its functionality is inherited by different text item types such as PointText, and AreaText (coming soon). They each add a layer of functionality that is unique to their type, but share the underlying properties and functions that they inherit from TextItem.
   */
  export class TextItem extends Item {
    /**
     * The text contents of the text item.
     */
    content: string;

    /**
     * The font-family to be used in text content.
     */
    fontFamily: string;

    /**
     * The font-weight to be used in text content.
     */
    fontWeight: string | number;

    /**
     * The font size of text content, as {@Number} in pixels, or as {@String} with optional units 'px', 'pt' and 'em'.
     */
    fontSize: string | number;

    /**
     * The text leading of text content.
     */
    leading: string | number;

    /**
     * The justification of text paragraphs.
     * String('left', 'right', 'center')
     */
    justification: string;
  }
}
