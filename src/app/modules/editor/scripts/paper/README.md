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

### Useful attributes/methods

#### `Point`

* `transform(m: paper.Matrix): paper.Point` - Transforms the point by the matrix as a new point.

#### `Matrix`

* `transform(p: paper.Point): paper.Point` - Transforms a point and returns the result.
* `inverseTransform(p: paper.Point): paper.Point` - Inverse transforms a point and returns the result.
* `appended(m: paper.Matrix): paper.Matrix` - Returns a new matrix as the result of appending the
  specified matrix to this matrix. This is the equivalent of multiplying `(this matrix) * (specified matrix)`.
* `prepended(m: paper.Matrix): paper.Matrix` - Returns a new matrix as the result of prepending the
  specified matrix to this matrix. This is the equivalent of multiplying `(specified matrix) s * (this matrix)`.

#### `Item`

* `globalMatrix: paper.Matrix` - The item's global transformation matrix in relation to the global
  project coordinate space. Note that the view's transformations resulting from zooming and
  panning are not factored in.
* `viewMatrix: paper.Matrix` - The item's global matrix in relation to the view coordinate space.
  This means that the view's transformations resulting from zooming and panning are factored in.
* `globalToLocal(p: paper.Point): paper.Point` - Converts the specified point from global
  project coordinate space to the item's own local coordinate space.
* `localToGlobal(p: paper.Point): paper.Point` - Converts the specified point from the
  item's own local coordinate space to the global project coordinate space.
* `parentToLocal(p: paper.Point): paper.Point` - Converts the specified point from the
  parent's coordinate space to item's own local coordinate space.
* `localToParent(p: paper.Point): paper.Point` - Converts the specified point from the
  item's own local coordinate space to the parent's coordinate space.

#### `View`

* `projectToView(p: paper.Point): paper.Point` - Converts the passed point from project
  coordinate space to view coordinate space, which is measured in browser pixels in relation
  to the position of the view element.
* `viewToProject(p: paper.Point): paper.Point` - Converts the passed point from view
  coordinate space to project coordinate space.

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
