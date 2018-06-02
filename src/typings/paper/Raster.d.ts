declare module 'paper' {
  /**
   * The Raster item represents an image in a Paper.js project.
   */
  export class Raster extends Item {
    /**
     * Creates a new raster item from the passed argument, and places it in the active layer. object can either be a DOM Image, a Canvas, or a string describing the URL to load the image from, or the ID of a DOM element to get the image from (either a DOM Image or a Canvas).
     * @param source [optional] - the source of the raster
     * @param position [optional] - the center position at which the raster item is placed
     */
    constructor(source?: HTMLImageElement | HTMLCanvasElement | string, position?: Point);
    constructor(config: any);

    /**
     * The size of the raster in pixels.
     */
    size: Size;

    /**
     * The width of the raster in pixels.
     */
    width: number;

    /**
     * The height of the raster in pixels.
     */
    height: number;

    /**
     * The resolution of the raster at its current size, in PPI (pixels per inch).
     */
    readonly resolution: Size;

    /**
     * The HTMLImageElement of the raster, if one is associated.
     */
    image: HTMLImageElement | HTMLCanvasElement;

    /**
     * The Canvas object of the raster. If the raster was created from an image,
     * accessing its canvas causes the raster to try and create one and draw the
     * image into it. Depending on security policies, this might fail, in which
     * case null is returned instead.
     */
    canvas: HTMLCanvasElement;

    /**
     * The Canvas 2D drawing context of the raster.
     */
    context: CanvasRenderingContext2D;

    /**
     * The source of the raster, which can be set using a DOM Image, a Canvas,
     * a data url, a string describing the URL to load the image from, or the
     * ID of a DOM element to get the image from (either a DOM Image or a Canvas).
     * Reading this property will return the url of the source image or a data-url.
     */
    source: HTMLImageElement | HTMLCanvasElement | string;

    /**
     * Extracts a part of the Raster's content as a sub image, and returns it as a Canvas object.
     * @param rect - the boundaries of the sub image in pixel coordinates
     */
    getSubCanvas(rect: Rectangle): HTMLCanvasElement;

    /**
     * Extracts a part of the raster item's content as a new raster item,
     * placed in exactly the same place as the original content.
     * @param rect - the boundaries of the sub raster in pixel coordinates
     */
    getSubRaster(rect: Rectangle): Raster;

    /**
     * Returns a Base 64 encoded data: URL representation of the raster.
     */
    toDataURL(): string;

    /**
     * Draws an image on the raster.
     * @param image - the image to draw
     * @param point - the offset of the image as a point in pixel coordinates
     */
    drawImage(image: HTMLImageElement | HTMLCanvasElement, point: Point): void;

    /**
     * Calculates the average color of the image within the given path,
     * rectangle or point. This can be used for creating raster image effects.
     * @param object - the path, rectangle or point to get the average image color from
     */
    getAverageColor(object: Path | Rectangle | Point): Color;

    /**
     * Gets the color of a pixel in the raster.
     * @param x - the x offset of the pixel in pixel coordinates
     * @param y - the y offset of the pixel in pixel coordinates
     */
    getPixel(x: number, y: number): Color;

    /**
     * Gets the color of a pixel in the raster.
     * @param point - the offset of the pixel as a point in pixel coordinates
     */
    getPixel(point: Point): Color;

    /**
     * Sets the color of the specified pixel to the specified color
     * @param x - the x offset of the pixel in pixel coordinates
     * @param y - the y offset of the pixel in pixel coordinates
     * @param color - the color that the pixel will be set to
     */
    setPixel(x: number, y: number, color: Color): void;

    /**
     * Sets the color of the specified pixel to the specified color.
     * @param point - the offset of the pixel as a point in pixel coordinates
     * @param color - the color that the pixel will be set to
     */
    setPixel(point: Point, color: Color): void;

    createImageData(size: Size): ImageData;

    getImageData(rect: Rectangle): ImageData;

    getImageData(data: ImageData, point: Point): void;
  }
}
