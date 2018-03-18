# paper.js notes

This `README.md` file contains notes about the trickier aspects of using the amazing `paper.js` library.
It also contains some implementation details specific to Shape Shifter that are important to remember.

## Setup

Say we want to create a `paper.js` `Project` with the following canvas:

```html
<canvas style="width: 600px; height: 600px;" width="1200" height="1200" />
```

In order to achieve this, we give our `Project` a `View` with the given size in CSS pixels (the canvas'
physical size will be assigned automatically, assuming `window.devicePixelRatio` is `2`):

```js
paper.project.view.viewSize = new paper.Size(600, 600);
```

Say we want to display a vector graphic with a viewport width/height of `24`. Then we create a root
`PaperLayer` for the `Project`:

```js
// 600 / 24 = 25 CSS pixels per viewport pixel.
const cssScaling = 600 / 24;

const layer = new PaperLayer();
layer.matrix = new paper.Matrix().scale(cssScaling);
paper.project.addLayer(layer);
```

`PaperLayer` is a special class that draws the vector graphic to the canvas, as well as a bunch of
other stuff, such as selection bounds, handles, segments, etc.

## Coordinate spaces

One of the trickiest aspects of using the library is dealing with different coordinate spaces.

### Project coordinates

* Project coordinates are in terms of the canvas' size in CSS pixels (note that the
  view's transformations resulting from zooming and panning are not factored in).
* Most of the `paper.js` API uses project coordinates (i.e. hit tests, mouse events, etc.).
* Project coordinate points are prefixed with `proj`.

### Physical coordinates

* Physical coordinates are in terms of the canvas' size in physical pixels.
* Physical coordinate points are prefixed with `phys`.
* To convert from project coordinates to physical coordinates, we can do:

```js
// Same as window.devicePixelRatio.
const pixelRatio = paper.project.view.pixelRatio;
const physPoint = projPoint.transform(new Matrix().scale(pixelRatio));
```

### View coordinates

* View coordinates are project coordinates with zooming/panning factored in.
* View coordinate points are prefixed with `view`.
* To convert from project coordinates to view coordinates, we can do:

```js
const viewPoint = paper.project.view.projectToView(projPoint);
```

### Viewport coordinates

* Viewport coordinate points are prefixed with `vp`.
* Note that points that are saved to the store should always be in terms of
  viewport coordinates.
* To convert from project coordinates to viewport coordinates, we can do:

```js
const vpPoint = paperLayer.globalToLocal(projPoint);

// ...which is the same as...

const vpPoint = new Matrix().scale(cssScaling).inverseTransform(projPoint);
```

### Local coordinates

* Local coordinate points are prefixed with `local`.

### Parent coordinates

* Parent coordinate points are prefixed with `parent`.

## Tools
