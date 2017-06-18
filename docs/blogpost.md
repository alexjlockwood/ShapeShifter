[Creative customization][creative-customization] is one of the tenets of material design; the subtle addition of an icon animation can add an element of wonder to the user experience, making your app feel more natural and alive. Unfortunately, building an icon animation from scratch using `VectorDrawable`s can be challenging. Not only does it take a fair amount of work to implement, but it also requires a vision of how the final result should look and feel. If you aren't familiar with the different techniques that are most often used to create icon animations, you're going to have a hard time designing your own.

This blog post covers several different techniques that you can use to create beautiful icon animations. The best way to learn is by example, so as you read through the post you'll encounter interactive demos highlighting how each technique works. I hope this blog post can at the very least open your eyes to how icon animations behave under-the-hood, because I genuinely believe that understanding how they work is the first step towards creating your own.

This post is split into the following sections:

<ol class="icon-anim-table-of-contents">
  <li><a href="#drawing-paths">Drawing <code>path</code>s</a></li>
  <li><a href="#transforming-groups-of-paths">Transforming <code>group</code>s of <code>path</code>s</a></li>
  <li><a href="#trimming-stroked-paths">Trimming stroked <code>path</code>s</a></li>
  <li><a href="#morphing-paths">Morphing <code>path</code>s</a></li>
  <li><a href="#clipping-paths">Clipping <code>path</code>s</a></li>
  <li><a href="#conclusion-putting-it-all-together">Conclusion: putting it all together</a></li>
</ol>

All of the icon animations in this blog post are available in `AnimatedVectorDrawable` format on [GitHub][adp-delightful-details]. I
also encourage you to check out [Shape Shifter](https://shapeshifter.design/), a side project I've been working on
that helps simplify the process of creating path morphing animations for Android and the web.

### Drawing `path`s

Before we can begin creating animated icons, we first need to understand how they are drawn. In Android, we'll create each icon using the relatively new [`VectorDrawable`][VectorDrawable] class. `VectorDrawable`s are similar in concept to SVGs on the web: they allow us to create scalable, density-independent assets by representing each icon as a series of lines and shapes called `path`s. Each path's shape is determined by a sequence of _drawing commands_, represented by a space/comma-separated string using a subset of the [SVG path data spec][svg-path-reference]. The spec defines many different types of commands, some of which are summarized in the table below:

| Command             | Description |
|---------------------|-------------|
| `M x,y`             | Begin a new subpath by moving to `(x,y)`.
| `L x,y`             | Draw a line to `(x,y)`.
| <code>C x<sub>1</sub>,y<sub>1</sub> x<sub>2</sub>,y<sub>2</sub> x,y</code> | Draw a [cubic bezier curve][cubic-bezier-curve] to `(x,y)` using control points <code>(x<sub>1</sub>,y<sub>1</sub>)</code> and <code>(x<sub>2</sub>,y<sub>2</sub>)</code>.
| `Z`                 | Close the path by drawing a line back to the beginning of the current subpath.

All `path`s come in one of two forms: _filled_ or _stroked_. If the path is filled, the interiors of its shape will be painted. If the path is stroked, the paint will be applied along the outline of its shape. Both types of `path`s have their own set of animatable attributes that further modify their appearance:

| Property name         | Element type | Value type | Min   | Max   |
|-----------------------|--------------|------------|-------|-------|
| `android:fillAlpha`   | `<path>`     | `float`    | `0`   | `1`   |
| `android:fillColor`   | `<path>`     | `integer`  | - - - | - - - |
| `android:strokeAlpha` | `<path>`     | `float`    | `0`   | `1`   |
| `android:strokeColor` | `<path>`     | `integer`  | - - - | - - - |
| `android:strokeWidth` | `<path>`     | `float`    | `0`   | - - - |

Let's see how this all works with an example. Say we wanted to create a play, pause, and record icon for a music application. We can represent each icon using a single `path`:

```xml
<vector
  xmlns:android="http://schemas.android.com/apk/res/android"
  android:width="48dp"
  android:height="48dp"
  android:viewportHeight="12"
  android:viewportWidth="12">

  <!-- This path draws an orange triangular play icon. -->
  <path
    android:fillColor="#FF9800"
    android:pathData="M 4,2.5 L 4,9.5 L 9.5,6 Z"/>

  <!-- This path draws two green stroked vertical pause bars. -->
  <path
    android:pathData="M 4,2.5 L 4,9.5 M 8,2.5 L 8,9.5"
    android:strokeColor="#0F9D58"
    android:strokeWidth="2"/>

  <!-- This path draws a red circle. -->
  <path
    android:fillColor="#DB4437"
    android:pathData="M 2,6 C 2,3.8 3.8,2 6,2 C 8.2,2 10,3.8 10,6 C 10,8.2 8.2,10 6,10 C 3.8,10 2,8.2 2,6"/>

</vector>
```

The triangular play and circular record icons are both filled `path`s with orange and red fill colors respectively. The pause icon, on the other hand, is a stroked `path` with a green stroke color and a stroke width of 2. **Figure 1** illustrates each `path`'s drawing commands executed inside a `12x12` grid:

<div id="drawing_path_commands_root">
  <div class="svgDemoContainer">
    <ul class="flex-container">
      <li class="flex-item">
        <div>
          <svg viewBox="0 0 241 241" class="svgDemoGraphic">
            <defs>
              <pattern id="smallGrid" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="gray" stroke-width="0.5" />
              </pattern>
              <pattern id="grid" width="80" height="80" patternUnits="userSpaceOnUse">
                <rect width="80" height="80" fill="url(#smallGrid)" />
                <path d="M 80 0 L 0 0 0 80" fill="none" stroke="gray" stroke-width="1" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
            <g transform="translate(120,120)">
              <g id="transform_paths_play_scale" transform="scale(1.5,1)">
                <g id="transform_paths_play_rotation" transform="rotate(90)">
                  <g transform="translate(-120,-120)">
                    <g id="transform_paths_play_translation" transform="translate(40,0)">
                      <path id="ic_play_basic_demo_path" fill="#FF9800" d="M 80 50 L 80 190 L 190 120 Z" />
                    </g>
                  </g>
                </g>
              </g>
            </g>
          </svg>
          <ul class="svgTransformPathsDemoList">
            <li class="svgBasicDemoPathInstruction">
              <label for="playTransformTranslationCheckbox" class="mdl-checkbox mdl-js-checkbox mdl-js-ripple-effect">
                <input type="checkbox" id="playTransformTranslationCheckbox" class="mdl-checkbox__input" checked>
                <span class="mdl-checkbox__label"><code>translateX="2"</code></span>
              </label>
            </li>
            <li class="svgBasicDemoPathInstruction">
              <label for="playTransformRotationCheckbox" class="mdl-checkbox mdl-js-checkbox mdl-js-ripple-effect">
                <input type="checkbox" id="playTransformRotationCheckbox" class="mdl-checkbox__input" checked>
                <span class="mdl-checkbox__label"><code>rotation="90"</code></span>
              </label>
            </li>
            <li class="svgBasicDemoPathInstruction">
              <label for="playTransformScaleCheckbox" class="mdl-checkbox mdl-js-checkbox mdl-js-ripple-effect">
                <input type="checkbox" id="playTransformScaleCheckbox" class="mdl-checkbox__input" checked>
                <span class="mdl-checkbox__label"><code>scaleX="1.5"</code></span>
              </label>
            </li>
          </ul>
        </div>
      </li>
      <li class="flex-item">
        <div>
          <svg viewBox="0 0 241 241" class="svgDemoGraphic">
            <defs>
              <pattern id="smallGrid" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="gray" stroke-width="0.5" />
              </pattern>
              <pattern id="grid" width="80" height="80" patternUnits="userSpaceOnUse">
                <rect width="80" height="80" fill="url(#smallGrid)" />
                <path d="M 80 0 L 0 0 0 80" fill="none" stroke="gray" stroke-width="1" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
            <g transform="translate(120,120)">
              <g id="transform_paths_pause_scale" transform="scale(1.5,1)">
                <g transform="translate(-120,-120)">
                  <g id="transform_paths_pause_translation" transform="translate(40,0)">
                    <g transform="translate(120,120)">
                      <g id="transform_paths_pause_rotation" transform="rotate(90)">
                        <g transform="translate(-120,-120)">
                          <path id="ic_pause_basic_demo_path" stroke="#0F9D58" stroke-width="40" d="M 80,50 L 80,190 M 160,50 L 160,190" />
                        </g>
                      </g>
                    </g>
                  </g>
                </g>
              </g>
            </g>
          </svg>
          <ul class="svgTransformPathsDemoList">
            <li class="svgBasicDemoPathInstruction">
              <label for="pauseTransformRotationCheckbox" class="mdl-checkbox mdl-js-checkbox mdl-js-ripple-effect">
                <input type="checkbox" id="pauseTransformRotationCheckbox" class="mdl-checkbox__input" checked>
                <span class="mdl-checkbox__label"><code>rotation="90"</code></span>
              </label>
            </li>
            <li class="svgBasicDemoPathInstruction">
              <label for="pauseTransformTranslationCheckbox" class="mdl-checkbox mdl-js-checkbox mdl-js-ripple-effect">
                <input type="checkbox" id="pauseTransformTranslationCheckbox" class="mdl-checkbox__input" checked>
                <span class="mdl-checkbox__label"><code>translateX="2"</code></span>
              </label>
            </li>
            <li class="svgBasicDemoPathInstruction">
              <label for="pauseTransformScaleCheckbox" class="mdl-checkbox mdl-js-checkbox mdl-js-ripple-effect">
                <input type="checkbox" id="pauseTransformScaleCheckbox" class="mdl-checkbox__input" checked>
                <span class="mdl-checkbox__label"><code>scaleX="1.5"</code></span>
              </label>
            </li>
          </ul>
        </div>
      </li>
      <li class="flex-item">
        <div>
          <svg viewBox="0 0 241 241" class="svgDemoGraphic">
            <defs>
              <pattern id="smallGrid" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="gray" stroke-width="0.5" />
              </pattern>
              <pattern id="grid" width="80" height="80" patternUnits="userSpaceOnUse">
                <rect width="80" height="80" fill="url(#smallGrid)" />
                <path d="M 80 0 L 0 0 0 80" fill="none" stroke="gray" stroke-width="1" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
            <g id="transform_paths_record_translation" transform="translate(40,0)">
              <g transform="translate(120,120)">
                <g id="transform_paths_record_rotation" transform="rotate(90)">
                  <g id="transform_paths_record_scale" transform="scale(1.5,1)">
                    <g transform="translate(-120,-120)">
                      <path id="ic_record_basic_demo_path" fill="#DB4437" d="
                M 40 120
                C 40 75.817220016 75.817220016 40 120 40
                C 164.182779984 40 200 75.817220016 200 120
                C 200 164.182779984 164.182779984 200 120 200
                C 75.817220016 200 40 164.182779984 40 120 Z" />
                    </g>
                  </g>
                </g>
              </g>
            </g>
          </svg>
          <ul class="svgTransformPathsDemoList">
            <li class="svgBasicDemoPathInstruction">
              <label for="recordTransformScaleCheckbox" class="mdl-checkbox mdl-js-checkbox mdl-js-ripple-effect">
                <input type="checkbox" id="recordTransformScaleCheckbox" class="mdl-checkbox__input" checked>
                <span class="mdl-checkbox__label"><code>scaleX="1.5"</code></span>
              </label>
            </li>
            <li class="svgBasicDemoPathInstruction">
              <label for="recordTransformRotationCheckbox" class="mdl-checkbox mdl-js-checkbox mdl-js-ripple-effect">
                <input type="checkbox" id="recordTransformRotationCheckbox" class="mdl-checkbox__input" checked>
                <span class="mdl-checkbox__label"><code>rotation="90"</code></span>
              </label>
            </li>
            <li class="svgBasicDemoPathInstruction">
              <label for="recordTransformTranslationCheckbox" class="mdl-checkbox mdl-js-checkbox mdl-js-ripple-effect">
                <input type="checkbox" id="recordTransformTranslationCheckbox" class="mdl-checkbox__input" checked>
                <span class="mdl-checkbox__label"><code>translateX="2"</code></span>
              </label>
            </li>
          </ul>
        </div>
      </li>
    </ul>
  </div>
  <p class="mdl-typography--caption mdl-typography--text-center"><strong>Figure 2.</strong> The effects of different combinations of <code>&lt;group&gt;</code> transformations on a play, pause, and record icon. The order of the checkboxes matches the order in which the transformations are applied in the sample code above. Android source code for each icon is available on <a href="https://gist.github.com/alexjlockwood/2d163aa6138a7f8894d76991456a9f68">GitHub</a>.</p>
</div>

As we previously mentioned, one of the benefits of `VectorDrawable`s is that they provide density independence, meaning that they can be scaled arbitrarily on any device without loss of quality. This ends up being both convenient and efficient: developers no longer need to go through the tedious process of exporting different sized PNGs for each screen density, which in turn also leads to a smaller APK size. In our case, however, **the reason we want to use `VectorDrawable`s is so we can animate their individual `path`s using the [`AnimatedVectorDrawable`][AnimatedVectorDrawable] class.** `AnimatedVectorDrawable`s are the glue that connect `VectorDrawable`s with `ObjectAnimator`s: the `VectorDrawable` assigns each animated `path` (or `group` of `path`s) a unique name, and the `AnimatedVectorDrawable` maps each of these names to their corresponding `ObjectAnimator`s. As we'll see below, the ability to animate the individual elements within a `VectorDrawable` can be quite powerful.

### Transforming `group`s of `path`s

In the previous section we learned how to alter a `path`'s appearance by directly modifying its properties, such as its opacity and color. In addition to this, `VectorDrawable`s also support _group transformations_ using the `<group>` tag, which allows us to apply transformations on multiple `path`s at a time using the following animatable attributes:

| Property name        | Element type | Value type |
|----------------------|--------------|------------|
| `android:pivotX`     | `<group>`    | `float`    |
| `android:pivotY`     | `<group>`    | `float`    |
| `android:rotation`   | `<group>`    | `float`    |
| `android:scaleX`     | `<group>`    | `float`    |
| `android:scaleY`     | `<group>`    | `float`    |
| `android:translateX` | `<group>`    | `float`    |
| `android:translateY` | `<group>`    | `float`    |

It's important to understand the order in which nested `group` transformations are applied. The two rules to remember are (1) children `group`s inherit the transformations applied by their parent groups, and (2) transformations made to the same `group` are applied in order of scale, rotation, and then translation. As an example, consider the following `group` transformations applied to the play, pause, and record icons discussed above:

```xml
<vector
  xmlns:android="http://schemas.android.com/apk/res/android"
  android:width="48dp"
  android:height="48dp"
  android:viewportHeight="12"
  android:viewportWidth="12">

  <!-- Translate the canvas, then rotate, then scale, then draw the play icon. -->
  <group android:scaleX="1.5" android:pivotX="6" android:pivotY="6">
    <group android:rotation="90" android:pivotX="6" android:pivotY="6">
      <group android:translateX="2">
        <path android:name="play_path"/>
      </group>
    </group>
  </group>

  <!-- Rotate the canvas, then translate, then scale, then draw the pause icon. -->
  <group android:scaleX="1.5" android:pivotX="6" android:pivotY="6">
    <group
      android:rotation="90" android:pivotX="6" android:pivotY="6"
      android:translateX="2">
      <path android:name="pause_path"/>
    </group>
  </group>

  <!-- Scale the canvas, then rotate, then translate, then draw the record icon. -->
  <group android:translateX="2">
    <group
      android:rotation="90"
      android:scaleX="1.5"
      android:pivotX="6"
      android:pivotY="6">
      <path android:name="record_path"/>
    </group>
  </group>

</vector>
```

The transformed icons are shown in **Figure 2** below. Toggle the checkboxes to see how the different combinations of transformations affect the results!

<!--{% include posts/2016/11/29/includes2_transforming_paths_demo.html %}-->

The ability to chain together `group` transformations makes it possible to achieve a variety of cool effects. **Figure 3** shows three such examples:

* The _expand/collapse icon_ is drawn using two rectangular paths. When clicked, the two paths are simultaneously rotated 90° and vertically translated to create the transition.

* The _alarm clock icon_ draws its bells using two rectangular paths. When clicked, a `<group>` containing the two paths is rotated back and forth about the center to create a 'ringing' effect.

* The _radio button icon_ animation is one of my favorites due to its clever simplicity. The icon is drawn using only two paths: a filled inner dot and a stroked outer ring. When the radio button transitions between an unchecked to checked state, three properties are animated:

    | Time  | Outer ring `strokeWidth` | Outer ring `scale{X,Y}` | Inner dot `scale{X,Y}` |
    |-------|--------------------------|-------------------------|------------------------|
    | 0     | 2                        | 1                       | 0                      |
    | 0.333 | 18                       | 0.5                     | 0                      |
    | 0.334 | 2                        | 0.9                     | 1.5                    |
    | 1     | 2                        | 1                       | 1                      |

    Pay particular attention to the first third of the animation, when the outer ring's stroke width and scale are simultaneously increased and decreased respectively to make it look as if the outer ring is collapsing inwards towards the center---a pretty awesome effect!


One last animation that makes use of group transformations is the _horizontal indeterminate progress bar_. A horizontal indeterminate progress bar consists of three paths: a translucent background and two inner rectangular paths. During the animation the two inner rectangles are horizontally translated and scaled at varying degrees. Toggle the checkboxes in **Figure 4** below to see how each transformation individually contributes to the animation!


### Trimming stroked `path`s

A lesser known property of stroked paths is that they can be _trimmed_. That is, given a stroked path we can choose to show only a portion of it before it is drawn to the display. In Android, this is done using the following animatable attributes:

| Property name            | Element type | Value type | Min | Max |
|--------------------------|--------------|------------|-----|-----|
| `android:trimPathStart`  | `<path>`     | `float`    | `0` | `1` |
| `android:trimPathEnd`    | `<path>`     | `float`    | `0` | `1` |
| `android:trimPathOffset` | `<path>`     | `float`    | `0` | `1` |

`trimPathStart` determines where the visible portion of the path will begin, while `trimPathEnd` determines where the visible portion of the path will end. An additional `trimPathOffset` may also be appended to the start and end values if desired. **Figure 5** demonstrates how this all works---update the sliders to see how different values affect what is drawn to the display! Note that it is perfectly fine for `trimPathStart` to be greater than `trimPathEnd`; if this occurs, the visible portion of the path simply wraps around the end of the segment back to the beginning.


The ability to animate these three properties opens up a world of possibilities. **Figure 6** shows four such examples:

* The _fingerprint icon_ consists of 5 stroked paths, each with their trim path start and end values initially set to `0` and `1` respectively. When hidden, the difference is quickly animated to `0` until the icon is no longer visible, and then quickly back to `1` when the icon is later shown. The _cursive handwriting icon_ behaves similarly, except instead of animating the individual paths all at once, they are animated sequentially as if the word was being written out by hand.

* The _search to back icon_ uses a clever combination of trim path animations in order to seamlessly transition between the stem of the search icon and the stem of a back arrow. Enable the 'show trim paths' checkbox and you'll see how the changing `trimPathStart` and `trimPathEnd` values affect the relative location of the stem as it animates to its new state. Enable the 'slow animation' checkbox and you'll also notice that the visible length of the stem changes over time: it expands slightly at the beginning and shrinks towards the end, creating a subtle 'stretching' effect that feels more natural. Creating this effect is actually quite easy: just begin animating one of the trim properties with a small start delay to make it look like one end of the path is animating faster than the other.

* Each animating digit in the _Google IO 2016 icon_ consists of 4 paths, each with a different stroke color and each with trim path start and end values covering a quarter of the digit's total length. Each path's `trimPathOffset` is then animated from `0` to `1` in order to create the effect.


Lastly, **Figure 7** shows how a stroked trim path is used to animate the familiar _circular indeterminate progress bar_. The icon consists of a single, circular stroked path that is animated as follows:

1. A `<group>` containing the progress bar path is rotated from 0° to 720° over the course of 4,444ms.

2. The progress bar path's trim path offset is animated from `0` to `0.25` over the course of 1,333ms.

3. Portions of the progress bar path are trimmed over the course of 1,333ms. Specifically, it animates through the following values:

    | Time | `trimPathStart` | `trimPathEnd` | `trimPathOffset` |
    |------|-----------------|---------------|------------------|
    | 0    | 0               | 0.03          | 0                |
    | 0.5  | 0               | 0.75          | 0.125            |
    | 1    | 0.75            | 0.78          | 0.25             |

    At time `t = 0.0`, the progress bar is at its smallest size (only 3% is visible). At `t = 0.5`, the progress bar has stretched to its maximum size (75% is visible). And at time `t = 1.0`, the progress bar has shrunk back to its smallest size, just as the animation is about to restart.


### Morphing `path`s

The most advanced icon animation technique we'll cover in this post is path morphing. Path morphing allows us to seamlessly transform the shapes of two paths by animating the differences in their drawing commands, as specified in their `android:pathData` attributes. With path morphing, we can transform a plus sign into a minus sign, a play icon into a pause icon, or even an overflow icon into a back arrow, as seen in **Figure 8** below.

| Property name      | Element type | Value type |
|--------------------|--------------|------------|
| `android:pathData` | `<path>`     | `string`   |

The first thing to consider when implementing a path morphing animation is whether or not the paths you want to morph are *compatible*. In order to morph path `A` into path `B` the following conditions must be met:

1. `A` and `B` have the same number of drawing commands.
2. The `i`th drawing command in `A` must have the same type as the `i`th drawing command in `B`, for all `i`.
3. The `i`th drawing command in `A` must have the same number of parameters as the `i`th drawing command in `B`, for all `i`.

If any of these conditions aren't met (i.e. attempting to morph an `L` command into a `C` command, or an `l` command with 2 coordinates into an `l` command with 4 coordinates, etc.), the application will crash with an exception. The reason these rules must be enforced is due to the way path morphing animations are implemented under-the-hood. Before the animation begins, the framework extracts the command types and their coordinates from each path's `android:pathData` attribute. If the conditions above are met, then the framework can assume that the only difference between the two paths are the values of the coordinates embedded in their drawing command strings. Under this assumption, the framework can execute the same sequence of drawing commands on each new display frame, re-calculating the values of the coordinates to use based on the current progress of the animation. **Figure 8** illustrates this concept nicely. First disable 'animate rotation', then enable the 'show path coordinates' and 'slow animation' checkboxes below. Notice how each path's red coordinates change during the course of the animation: they travel a straight line from their starting positions in path `A` to their ending positions in path `B`. Path morphing animations are really that simple!


Although conceptually simple, path morphing animations are known at times for being tedious and time-consuming to implement. For example, you'll often need to tweak the start and end paths by hand in order to make the two paths compatible to be morphed, which, depending on the complexity of the paths, is where most of the work will probably be spent. Listed below are several tips and tricks that I've found useful in getting started:

* Adding *dummy coordinates* is often necessary in order to make a simple path compatible with a more complex path. Dummy coordinates were added to nearly all of the examples shown **Figure 8**. For example, consider the plus-to-minus animation. We could draw a rectangular minus path using only 4 drawing commands. However, drawing the more complex plus path requires 12 drawing commands, so in order to make the two paths compatible we must add 8 additional noop drawing commands to the simpler minus path. Compare the two paths' [drawing command strings][PlusMinusPathCommands] and see if you can identify these dummy coordinates for yourself!

* A cubic bezier curve command can be used to draw a straight line by setting its pair of control points equal to its start and end points respectively. This can be useful to know if you ever find yourself morphing an `L` command into a `C` command (such as in the overflow-to-arrow and animating digit examples above). It is also possible to estimate an [elliptical arc command][EllipticalArcCommand] using one or more cubic bezier curves, as I previously discussed [here][ConvertEllipticalArcToBezierCurve]. This can also be useful to know if you ever find yourself in a situation where you need to morph a `C` command into an `A` command.

* Sometimes morphing one path into another looks awkward no matter how you do it. In my experience, I've found that adding a 180° or 360° degree rotation to the animation can make them look significantly better: the additional rotation distracts the eye from the morphing paths and adds a layer of motion that makes the animation seem more responsive to the user's touch.

* Remember that path morphing animations are ultimately determined by the relative positioning of each path's drawing command coordinates. For best results, try to minimize the distance each coordinate has to travel over the course of the animation: the smaller the distance each coordinate has to animate, the more seamless the path morphing animation will usually appear.

### Clipping `path`s

The last technique we'll cover involves animating the bounds of a `<clip-path>`. A clip path restricts the region to which paint can be applied to the canvas---anything that lies outside of the region bounded by a clip path will not be drawn. By animating the bounds of these regions, we can create some cool effects, as we'll see below.

| Property name      | Element type  | Value type |
|--------------------|---------------|------------|
| `android:pathData` | `<clip-path>` | `string`   |

A `<clip-path>`'s bounds can be animated via path morphing by animating the differences in its path commands, as specified by its `android:pathData` attribute. Take a look at the examples in **Figure 9** to get a better idea of how these animations work. Enabling the 'show clip paths' checkbox will show a red overlay mask representing the bounds of the currently active `<clip-path>`, which in turn dictates the portions of its sibling `<path>`s that will be drawn. Clip path are especially useful for animating 'fill' effects, as demonstrated in the hourglass and heart fill/break examples below.


### Conclusion: putting it all together

If you've made it this far in the blog post, that means you now have all of the fundamental building blocks you need in order to design your own icon animations from scratch! To celebrate, let's finish off this ridiculously enormous blog post once and for all with one last kickass example! Consider the progress icon in **Figure 10**, which animates the following six properties:

1. Fill alpha (at the end when fading out the downloading arrow).
2. Stroke width (during the progress indicator to check mark animation).
3. Translation and rotation (at the beginning to create the 'bouncing arrow' effect).
4. Trim path start/end (at the end when transitioning from the progress bar to the check mark).
5. Path morphing (at the beginning to create the 'bouncing line' effect, and at the end while transitioning the check mark back into an arrow).
6. Clip path (vertically filling the contents of the downloading arrow to indicate indeterminate progress).


That's all I've got for now... thanks for reading! Remember to +1 this blog or leave a comment below if you have any questions. And remember that all of the icon animations in this blog post (and more) are available in `AnimatedVectorDrawable` format on [GitHub][adp-delightful-details]. Feel free to steal them for your own application if you want!

### Reporting bugs & feedback

If you notice a glitch in one of the animated demos on this page, please report them [here][alexjlockwood.github.io-new-bug]. All of the animations work fine for me using the latest version of Chrome. That said, I only began learning JavaScript a few weeks ago so I wouldn't be surprised if I made a mistake somewhere along the line. I want this blog post to be perfect, so I'd really appreciate it! :)

### Special thanks

I'd like to give a **huge** thanks to [Nick Butcher][NickButcherGooglePlus], because I probably would never have written this blog post without his help and advice! Several of the animations in this blog post were borrowed from his amazing open source application [Plaid][plaid-source-code], which I highly recommend you check out if you haven't already. I'd also like to thank [Roman Nurik][RomanNurikGooglePlus] for his [Android Icon Animator][AndroidIconAnimator] tool and for inspiring the path morphing animations in Figure 10. Finally, I'd like to thank [Sriram Ramani][SriramRamani] for his [blog post on number tweening][NumberTweeningBlogPost], which inspired the animated digits demo in Figure 8. Thanks again!

  [adp-delightful-details]: https://github.com/alexjlockwood/adp-delightful-details
  [svg-path-reference]: http://www.w3.org/TR/SVG11/paths.html#PathData
  [cubic-bezier-curve]: https://en.wikipedia.org/wiki/B%C3%A9zier_curve
  [RomanNurikGooglePlus]: https://plus.google.com/+RomanNurik
  [NickButcherGooglePlus]: https://plus.google.com/+NickButcher
  [VectorDrawable]: https://developer.android.com/reference/android/graphics/drawable/VectorDrawable.html
  [AnimatedVectorDrawable]: https://developer.android.com/reference/android/graphics/drawable/AnimatedVectorDrawable.html
  [creative-customization]: https://material.google.com/motion/creative-customization.html
  [alexjlockwood.github.io-new-bug]: https://github.com/alexjlockwood/alexjlockwood.github.io/issues/new
  [adp-delightful-details-new-bug]: https://github.com/alexjlockwood/adp-delightful-details/issues/new
  [plaid-source-code]: https://github.com/nickbutcher/plaid
  [AndroidIconAnimator]: https://romannurik.github.io/AndroidIconAnimator/
  [SriramRamani]: https://sriramramani.wordpress.com/
  [NumberTweeningBlogPost]: https://sriramramani.wordpress.com/2013/10/14/number-tweening/
  [PlusMinusPathCommands]: https://github.com/alexjlockwood/adp-delightful-details/blob/master/app/src/main/res/values/pathmorph_plusminus.xml
  [ConvertEllipticalArcToBezierCurve]: https://plus.google.com/+AlexLockwood/posts/1q26J7qqkTZ
  [EllipticalArcCommand]: https://www.w3.org/TR/SVG/paths.html#PathDataEllipticalArcCommands
