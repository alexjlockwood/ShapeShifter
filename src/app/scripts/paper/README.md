# paper.js notes

This `README.md` file contains notes about the trickier aspects of using the amazing `paper.js` library.
It also contains some implementation details specific to Shape Shifter that are important to remember.

## Setup

Say we want to create a `paper.js` `Project` with the following canvas:

```html
<canvas style="width: 600px; height: 600px;" width="1200" height="1200" />
```

In order to achieve this, we give our `Project` a `View` with the given size in CSS pixels (the canvas' physical size will be assigned automatically, assuming `window.devicePixelRatio` is `2`):

```js
paper.project.view.viewSize = new paper.Size(600, 600);
```

Say we want to display a vector graphic with a viewport width/height of `24`. Then we create a root `Layer` for the `Project`:

```js
// 600 / 24 = 25 CSS pixels per viewport pixel.
const cssScaling = 600 / 24;

const layer = new paper.Layer();
layer.matrix = new paper.Matrix().scale(cssScaling);
paper.project.addLayer(layer);
```

## Coordinate spaces

One of the trickiest aspects of using the library is dealing with different coordinate spaces.

### Project coordinates

### Physical coordinates

### View coordinates

### Viewport coordinates

### Local coordinates

### Parent coordinates

## Tools
