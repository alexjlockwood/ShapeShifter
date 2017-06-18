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

<div>
  <div class="svgDemoContainer">
    <ul class="flex-container">
      <li class="flex-item">
        <svg id="ic_expand_collapse" viewBox="0 0 24 24" class="svgDemoGraphic">
          <g id="chevron" transform="translate(12,15)">
            <g id="leftBar" transform="rotate(135)">
              <g transform="translate(0,3)">
                <path id="leftBarPath" class="delightIconFillPath" d="M1-4v8h-2v-8z" />
                <path id="leftBarPathHighlight" class="delightIconHighlightPath" stroke-width="0.4" d="M1-4v8h-2v-8z" />
              </g>
            </g>
            <g id="rightBar" transform="rotate(45)">
              <g transform="translate(0,-3)">
                <path id="rightBarPath" class="delightIconFillPath" d="M1-4v8h-2v-8z" />
                <path id="rightBarPathHighlight" class="delightIconHighlightPath" stroke-width="0.4" d="M1-4v8h-2v-8z" />
              </g>
            </g>
          </g>
        </svg>
      </li>
      <li class="flex-item">
        <svg id="ic_alarm" viewBox="0 0 24 24" class="svgDemoGraphic">
          <g transform="translate(12,12)">
            <g id="alarmclock_button_rotation">
              <g transform="translate(-12,-12)">
                <g transform="translate(19.0722,4.5758)">
                  <path id="basicTransformationAlarmLeftBell" class="delightIconFillPath" d="M2.94 1.162l-4.595-3.857L-2.94-1.16l4.595 3.855L2.94 1.162z" />
                  <path id="basicTransformationAlarmLeftBellHighlight" class="delightIconHighlightPath" stroke-width="0.4" d="M2.94 1.162l-4.595-3.857L-2.94-1.16l4.595 3.855L2.94 1.162z" />
                </g>
                <g transform="translate(4.9262,4.5729)">
                  <path id="basicTransformationAlarmRightBell" class="delightIconFillPath" d="M2.94-1.163L1.656-2.695-2.94 1.16l1.285 1.535L2.94-1.163z" />
                  <path id="basicTransformationAlarmRightBellHighlight" class="delightIconHighlightPath" stroke-width="0.4" d="M2.94-1.163L1.656-2.695-2.94 1.16l1.285 1.535L2.94-1.163z" />
                </g>
              </g>
            </g>
          </g>
          <path id="basicTransformationAlarmHands" class="delightIconFillPath" d="M12.5 8.02H11v6l4.747 2.854.753-1.232-4-2.372V8.02z" />
          <path id="basicTransformationAlarmRing" class="delightIconFillPath" d="M11.995 4.02C7.02 4.02 3 8.05 3 13.02s4.02 9 8.995 9S21 17.99 21 13.02s-4.03-9-9.005-9zm.005 16c-3.867 0-7-3.134-7-7s3.133-7 7-7 7 3.134 7 7-3.133 7-7 7z" />
        </svg>
      </li>
      <li class="flex-item">
        <svg id="ic_radiobutton" viewBox="0 0 32 32" class="svgDemoGraphic">
          <g transform="translate(16,16)">
            <g id="radiobutton_ring_group">
              <path id="radiobutton_ring_path" class="delightIconStrokePath" stroke-width="2" d="M-9 0A9 9 0 1 0 9 0 9 9 0 1 0-9 0" />
              <path id="radiobutton_ring_path_highlight" class="delightIconHighlightPath" stroke-width="0.3" d="M-9 0A9 9 0 1 0 9 0 9 9 0 1 0-9 0" />
            </g>
            <g id="radiobutton_dot_group" transform="scale(0,0)">
              <path id="radiobutton_dot_path" class="delightIconFillPath" d="M-5 0A5 5 0 1 0 5 0 5 5 0 1 0-5 0" />
              <path id="radiobutton_dot_path_highlight" class="delightIconHighlightPath" stroke-width="0.3" d="M-5 0A5 5 0 1 0 5 0 5 5 0 1 0-5 0" />
            </g>
          </g>
        </svg>
      </li>
    </ul>
    <div class="svgDemoCheckboxContainer">
      <label for="basicTransformationHighlightAnimatingPathsCheckbox" class="mdl-checkbox mdl-js-checkbox mdl-js-ripple-effect">
        <input type="checkbox" id="basicTransformationHighlightAnimatingPathsCheckbox" class="mdl-checkbox__input">
        <span class="mdl-checkbox__label">Highlight animated paths</span>
      </label>
      <label for="basicTransformationSlowAnimationCheckbox" class="mdl-checkbox mdl-js-checkbox mdl-js-ripple-effect">
        <input type="checkbox" id="basicTransformationSlowAnimationCheckbox" class="mdl-checkbox__input">
        <span class="mdl-checkbox__label">Slow animation</span>
      </label>
    </div>
  </div>
  <p class="mdl-typography--caption mdl-typography--text-center"><strong>Figure 3.</strong> Understanding how <code>&lt;group&gt;</code> transformations can be used to create icon animations. Android source code for each is available on GitHub: (a)
    <a href="https://github.com/alexjlockwood/adp-delightful-details/blob/master/app/src/main/res/drawable/asl_checkable_expandcollapse.xml">expand to collapse</a>, (b)
    <a href="https://github.com/alexjlockwood/adp-delightful-details/blob/master/app/src/main/res/drawable/avd_clock_alarm.xml">alarm clock</a>, and (c)
    <a href="https://github.com/alexjlockwood/adp-delightful-details/blob/master/app/src/main/res/drawable/asl_checkable_radiobutton.xml">radio button</a>. Click each icon to start its animation.</p>
</div>

One last animation that makes use of group transformations is the _horizontal indeterminate progress bar_. A horizontal indeterminate progress bar consists of three paths: a translucent background and two inner rectangular paths. During the animation the two inner rectangles are horizontally translated and scaled at varying degrees. Toggle the checkboxes in **Figure 4** below to see how each transformation individually contributes to the animation!

<div>
  <div id="svgLinearProgressDemo" class="svgDemoContainer">
    <div id="progressBarContainer">
      <div id="progressBar">
        <div id="progressBarOuterRect1">
          <div id="progressBarInnerRect1"></div>
        </div>
        <div id="progressBarOuterRect2">
          <div id="progressBarInnerRect2"></div>
        </div>
      </div>
    </div>
    <div class="svgDemoCheckboxContainer">
      <label for="linearProgressScaleCheckbox" class="mdl-checkbox mdl-js-checkbox mdl-js-ripple-effect">
        <input type="checkbox" id="linearProgressScaleCheckbox" class="mdl-checkbox__input" checked>
        <span class="mdl-checkbox__label">Animate scale</span>
      </label>
      <label for="linearProgressTranslateCheckbox" class="mdl-checkbox mdl-js-checkbox mdl-js-ripple-effect">
        <input type="checkbox" id="linearProgressTranslateCheckbox" class="mdl-checkbox__input" checked>
        <span class="mdl-checkbox__label">Animate translation</span>
      </label>
    </div>
  </div>
  <p class="mdl-typography--caption mdl-typography--text-center"><strong>Figure 4.</strong> Understanding how scale and translation are used to animate a horizontal indeterminate progress indicator (<a href="https://github.com/alexjlockwood/adp-delightful-details/blob/master/app/src/main/res/drawable/avd_progress_indeterminate_horizontal.xml">source code</a>).</p>
</div>

### Trimming stroked `path`s

A lesser known property of stroked paths is that they can be _trimmed_. That is, given a stroked path we can choose to show only a portion of it before it is drawn to the display. In Android, this is done using the following animatable attributes:

| Property name            | Element type | Value type | Min | Max |
|--------------------------|--------------|------------|-----|-----|
| `android:trimPathStart`  | `<path>`     | `float`    | `0` | `1` |
| `android:trimPathEnd`    | `<path>`     | `float`    | `0` | `1` |
| `android:trimPathOffset` | `<path>`     | `float`    | `0` | `1` |

`trimPathStart` determines where the visible portion of the path will begin, while `trimPathEnd` determines where the visible portion of the path will end. An additional `trimPathOffset` may also be appended to the start and end values if desired. **Figure 5** demonstrates how this all works---update the sliders to see how different values affect what is drawn to the display! Note that it is perfectly fine for `trimPathStart` to be greater than `trimPathEnd`; if this occurs, the visible portion of the path simply wraps around the end of the segment back to the beginning.

<div>
  <div class="svgDemoContainer">
    <svg id="ic_line_path" viewBox="0 0 24 1" width="95%">
      <path id="line_path_background" fill="none" stroke="#000" stroke-opacity="0.26" stroke-width=".25" d="M 0.5,0.5 h 23" />
      <path id="line_path" fill="none" stroke="#000" stroke-width=".25" stroke-dasharray="11.5,11.5" d="M 0.5,0.5 h 23" />
    </svg>
    <div class="sliderContainer">
      <div class="sliderTextContainer">
        <div class="slider">
          <input id="trimPathStart" class="mdl-slider mdl-js-slider sliderInput" type="range" min="0" max="100" value="0" tabindex="0">
        </div>
        <div class="sliderText"><code>trimPathStart="<span id="trimPathStartValue">0</span>"</code></div>
      </div>
      <div class="sliderTextContainer">
        <div class="slider">
          <input id="trimPathEnd" class="mdl-slider mdl-js-slider sliderInput" type="range" min="0" max="100" value="50" tabindex="0">
        </div>
        <div class="sliderText"><code>trimPathEnd="<span id="trimPathEndValue">0.5</span>"</code></div>
      </div>
      <div class="sliderTextContainer">
        <div class="slider">
          <input id="trimPathOffset" class="mdl-slider mdl-js-slider sliderInput" type="range" min="0" max="100" value="0" tabindex="0">
        </div>
        <div class="sliderText"><code>trimPathOffset="<span id="trimPathOffsetValue">0</span>"</code></div>
      </div>
    </div>
  </div>
  <p class="mdl-typography--caption mdl-typography--text-center"><strong>Figure 5.</strong> Understanding the effects of the <code>trimPathStart</code>, <code>trimPathEnd</code>, and <code>trimPathOffset</code> properties on a stroked path.</p>
</div>

The ability to animate these three properties opens up a world of possibilities. **Figure 6** shows four such examples:

* The _fingerprint icon_ consists of 5 stroked paths, each with their trim path start and end values initially set to `0` and `1` respectively. When hidden, the difference is quickly animated to `0` until the icon is no longer visible, and then quickly back to `1` when the icon is later shown. The _cursive handwriting icon_ behaves similarly, except instead of animating the individual paths all at once, they are animated sequentially as if the word was being written out by hand.

* The _search to back icon_ uses a clever combination of trim path animations in order to seamlessly transition between the stem of the search icon and the stem of a back arrow. Enable the 'show trim paths' checkbox and you'll see how the changing `trimPathStart` and `trimPathEnd` values affect the relative location of the stem as it animates to its new state. Enable the 'slow animation' checkbox and you'll also notice that the visible length of the stem changes over time: it expands slightly at the beginning and shrinks towards the end, creating a subtle 'stretching' effect that feels more natural. Creating this effect is actually quite easy: just begin animating one of the trim properties with a small start delay to make it look like one end of the path is animating faster than the other.

* Each animating digit in the _Google IO 2016 icon_ consists of 4 paths, each with a different stroke color and each with trim path start and end values covering a quarter of the digit's total length. Each path's `trimPathOffset` is then animated from `0` to `1` in order to create the effect.

<div id="includes6">
  <div class="svgDemoContainer">
    <ul class="flex-container">
      <li class="flex-item">
        <svg id="ic_fingerprint" viewBox="0 0 32 32" class="svgTrimPathDemoGraphic">
          <g transform="translate(49.3335,50.66685)">
            <path id="ridge_5_path_debug" class="delightIconFingerPrintStrokePathDebug" d="M-25.36-24.414c-.568.107-1.126.14-1.454.14-1.297 0-2.532-.343-3.62-1.123-1.677-1.204-2.77-3.17-2.77-5.392" />
            <path id="ridge_7_path_debug" class="delightIconFingerPrintStrokePathDebug" d="M-36.14-21.784c-1.006-1.193-1.576-1.918-2.366-3.502-.828-1.66-1.314-3.492-1.314-5.485 0-3.664 2.97-6.633 6.633-6.633 3.662 0 6.632 2.97 6.632 6.632" />
            <path id="ridge_6_path_debug" class="delightIconFingerPrintStrokePathDebug" d="M-42.19-25.676c-.76-2.143-.897-3.87-.897-5.13 0-1.46.25-2.847.814-4.096 1.562-3.45 5.035-5.85 9.068-5.85 5.495 0 9.95 4.453 9.95 9.947 0 1.832-1.486 3.316-3.318 3.316-1.83 0-3.316-1.483-3.316-3.315 0-1.83-1.483-3.316-3.315-3.316-1.83 0-3.316 1.484-3.316 3.315 0 2.57.99 4.887 2.604 6.587 1.222 1.285 2.432 2.1 4.476 2.69" />
            <path id="ridge_2_path_debug" class="delightIconFingerPrintStrokePathDebug" d="M-44.065-38.167c1.19-1.775 2.675-3.246 4.56-4.273 1.883-1.028 4.044-1.61 6.34-1.61 2.29 0 4.44.578 6.32 1.597 1.878 1.02 3.36 2.48 4.552 4.242" />
            <path id="ridge_1_path_debug" class="delightIconFingerPrintStrokePathDebug" d="M71.78 97.05c-2.27-1.313-4.712-2.07-7.56-2.07-2.85 0-5.234.78-7.345 2.07" />
            <path id="ridge_5_path" class="delightIconFingerPrintStrokePath" d="M-25.36-24.414c-.568.107-1.126.14-1.454.14-1.297 0-2.532-.343-3.62-1.123-1.677-1.204-2.77-3.17-2.77-5.392" />
            <path id="ridge_7_path" class="delightIconFingerPrintStrokePath" d="M-36.14-21.784c-1.006-1.193-1.576-1.918-2.366-3.502-.828-1.66-1.314-3.492-1.314-5.485 0-3.664 2.97-6.633 6.633-6.633 3.662 0 6.632 2.97 6.632 6.632" />
            <path id="ridge_6_path" class="delightIconFingerPrintStrokePath" d="M-42.19-25.676c-.76-2.143-.897-3.87-.897-5.13 0-1.46.25-2.847.814-4.096 1.562-3.45 5.035-5.85 9.068-5.85 5.495 0 9.95 4.453 9.95 9.947 0 1.832-1.486 3.316-3.318 3.316-1.83 0-3.316-1.483-3.316-3.315 0-1.83-1.483-3.316-3.315-3.316-1.83 0-3.316 1.484-3.316 3.315 0 2.57.99 4.887 2.604 6.587 1.222 1.285 2.432 2.1 4.476 2.69" />
            <path id="ridge_2_path" class="delightIconFingerPrintStrokePath" d="M-44.065-38.167c1.19-1.775 2.675-3.246 4.56-4.273 1.883-1.028 4.044-1.61 6.34-1.61 2.29 0 4.44.578 6.32 1.597 1.878 1.02 3.36 2.48 4.552 4.242" />
            <path id="ridge_1_path" class="delightIconFingerPrintStrokePath" d="M71.78 97.05c-2.27-1.313-4.712-2.07-7.56-2.07-2.85 0-5.234.78-7.345 2.07" />
          </g>
        </svg>
      </li>
      <li class="flex-item">
        <svg id="ic_search_back" viewBox="0 0 48 24" class="svgTrimPathDemoGraphic">
          <path id="stem_debug" class="delightIconSearchToBackStrokePathDebug" d="M24.7 12.7l7.117 7.207C32.787 20.7 34.46 23 37.5 23s5.5-2.46 5.5-5.5-2.46-5.5-5.5-5.5h-5.683-12.97" />
          <path id="search_circle_debug" class="delightIconSearchToBackStrokePathDebug" d="M25.39 13.39a5.5 5.5 0 1 1-7.78-7.78 5.5 5.5 0 1 1 7.78 7.78" />
          <g id="arrow_head_debug">
            <path id="arrow_head_top_debug" class="delightIconSearchToBackStrokePathDebug" d="M16.702 12.696l8.002-8.003" />
            <path id="arrow_head_bottom_debug" class="delightIconSearchToBackStrokePathDebug" d="M16.71 11.276l8.012 8.012" />
          </g>
          <path id="stem" class="delightIconSearchToBackStrokePath" d="M24.7 12.7l7.117 7.207C32.787 20.7 34.46 23 37.5 23s5.5-2.46 5.5-5.5-2.46-5.5-5.5-5.5h-5.683-12.97" stroke-dasharray="9.75516635929,42.975462608" />
          <path id="search_circle" class="delightIconSearchToBackStrokePath" d="M25.39 13.39a5.5 5.5 0 1 1-7.78-7.78 5.5 5.5 0 1 1 7.78 7.78" />
          <g id="arrow_head" transform="translate(8,0)">
            <path id="arrow_head_top" class="delightIconSearchToBackStrokePath" d="M16.702 12.696l8.002-8.003" stroke-dashoffset="11.317" stroke-dasharray="11.317" />
            <path id="arrow_head_bottom" class="delightIconSearchToBackStrokePath" d="M16.71 11.276l8.012 8.012" stroke-dashoffset="11.33" stroke-dasharray="11.33" />
          </g>
        </svg>
      </li>
      <li class="flex-item">
        <svg id="ic_android_handwriting" viewBox="0 0 170 68" class="svgTrimPathDemoGraphic">
          <g transform="translate(2, 12)">
            <path id="andro_debug" class="delightIconHandwritingStrokePathDebug" d="M.342 40.576c10.073 8.093 17.46-26.214 24.843-37.008-2.504 13.87-.942 31.505 5.634 34.256 6.575 2.752 10.747-12.91 13.866-20.387 0 7.477-7.16 19.9-5.436 20.876 3.597-7.226 10.768-15.395 13.076-16.554 2.307-1.16-1.44 14.734.942 14.376 8.927 2.946 8.88-19.38 21.295-12.37-12.416-4.875-12.516 11.16-11.494 12.643C76.07 34.924 86 6.615 81.632.9 72.673-.873 72.18 37.314 76.07 38.14c10.548-.318 14.896-18.363 13.145-22.848-5.363 7.766 2.17 5.983 4.633 9.62 2.506 3.4-3.374 14.54 2.506 13.907 4.856-.844 15.163-23.165 17.118-17.82-5.727-2.37-10.81 16.224-4.143 16.824 8.588.318 9.125-16.823 4.142-17.34" />
            <path id="id_debug" class="delightIconHandwritingStrokePathDebug" d="M126.046 22.4c-4.284 6.404-2.96 14.827-.092 15.973 4.31 3.24 12.428-18.428 18.5-16.612-13.063 5.738-9.164 14.542-7.253 14.542 15.016-1.847 21.977-34.67 18.283-36.193-9.478 5.223-9.927 36.192-5.008 38.058 6.956 0 10.04-9.364 10.04-9.364" />
            <path id="a_debug" class="delightIconHandwritingStrokePathDebug" d="M15.513 25.218c4.082 0 15.976-2.228 15.976-2.228" />
            <path id="i1_dot_debug" class="delightIconHandwritingStrokePathDebug" d="M127.723 15.887l-.56 1.116" />
            <path id="andro" class="delightIconHandwritingStrokePath" d="M.342 40.576c10.073 8.093 17.46-26.214 24.843-37.008-2.504 13.87-.942 31.505 5.634 34.256 6.575 2.752 10.747-12.91 13.866-20.387 0 7.477-7.16 19.9-5.436 20.876 3.597-7.226 10.768-15.395 13.076-16.554 2.307-1.16-1.44 14.734.942 14.376 8.927 2.946 8.88-19.38 21.295-12.37-12.416-4.875-12.516 11.16-11.494 12.643C76.07 34.924 86 6.615 81.632.9 72.673-.873 72.18 37.314 76.07 38.14c10.548-.318 14.896-18.363 13.145-22.848-5.363 7.766 2.17 5.983 4.633 9.62 2.506 3.4-3.374 14.54 2.506 13.907 4.856-.844 15.163-23.165 17.118-17.82-5.727-2.37-10.81 16.224-4.143 16.824 8.588.318 9.125-16.823 4.142-17.34" />
            <path id="id" class="delightIconHandwritingStrokePath" d="M126.046 22.4c-4.284 6.404-2.96 14.827-.092 15.973 4.31 3.24 12.428-18.428 18.5-16.612-13.063 5.738-9.164 14.542-7.253 14.542 15.016-1.847 21.977-34.67 18.283-36.193-9.478 5.223-9.927 36.192-5.008 38.058 6.956 0 10.04-9.364 10.04-9.364" />
            <path id="a" class="delightIconHandwritingStrokePath" d="M15.513 25.218c4.082 0 15.976-2.228 15.976-2.228" />
            <path id="i1_dot" class="delightIconHandwritingStrokePath" d="M127.723 15.887l-.56 1.116" />
          </g>
        </svg>
      </li>
      <li class="flex-item">
        <svg id="ic_io16_handwriting" viewBox="0 0 360 200" class="svgTrimPathDemoGraphic">
          <path id="io16_hash" class="delightIconIo16StrokePath" stroke="#5C6BC0" stroke-linecap="round" d="M39,45L39,80 M57,45L57,80 M66,54L31,54 M66,71L31,71" />
          <path id="io16_i_body" class="delightIconIo16StrokePath" stroke="#5C6BC0" d="M83,82L107,82A2,2 0,0 1,109 84L109,155A2,2 0,0 1,107 157L83,157A2,2 0,0 1,81 155L81,84A2,2 0,0 1,83 82z" />
          <path id="io16_i_dot" class="delightIconIo16StrokePath" stroke="#5C6BC0" d="M94,59m-14,0a14,14 0,1 1,28 0a14,14 0,1 1,-28 0" />
          <path id="io16_o" class="delightIconIo16StrokePath" stroke="#5C6BC0" d="M159.5,119.5m-37.5,0a37.5,37.5 0,1 1,75 0a37.5,37.5 0,1 1,-75 0" />
          <path id="io16_one_1" class="delightIconIo16StrokePath" stroke="#84FFFF" d="M211,45L235,45A2,2 0,0 1,237 47L237,155A2,2 0,0 1,235 157L211,157A2,2 0,0 1,209 155L209,47A2,2 0,0 1,211 45z" />
          <path id="io16_one_2" class="delightIconIo16StrokePath" stroke="#E91E63" d="M211,45L235,45A2,2 0,0 1,237 47L237,155A2,2 0,0 1,235 157L211,157A2,2 0,0 1,209 155L209,47A2,2 0,0 1,211 45z" />
          <path id="io16_one_3" class="delightIconIo16StrokePath" stroke="#5C6BC0" d="M211,45L235,45A2,2 0,0 1,237 47L237,155A2,2 0,0 1,235 157L211,157A2,2 0,0 1,209 155L209,47A2,2 0,0 1,211 45z" />
          <path id="io16_one_4" class="delightIconIo16StrokePath" stroke="#4DD0E1" d="M211,45L235,45A2,2 0,0 1,237 47L237,155A2,2 0,0 1,235 157L211,157A2,2 0,0 1,209 155L209,47A2,2 0,0 1,211 45z" />
          <path id="io16_six_1" class="delightIconIo16StrokePath" stroke="#84FFFF" d="M302.14,60.72C302.29,61.46 276.46,97.06 270.1,112.55C260.87,138.44 278.6,149.83 284.3,152.76C299.15,160.38 316.85,150.27 323.08,141.43C329.3,132.59 333.05,109.99 316.85,100.57C306.85,94.75 290.54,97.32 290.2,97.06C289.85,96.79 276.32,81.31 276.46,80.88C276.6,80.45 294.73,77.62 302.88,84.28C315.76,92.99 315.62,114.99 306.84,127.42C298.06,139.85 276.46,144.38 260.54,130.73C238.46,111.79 259.06,85.64 260.87,83.1C260.87,83.1 286.23,46.19 286.83,46.03C287.43,45.87 301.99,59.99 302.14,60.72Z" />
          <path id="io16_six_2" class="delightIconIo16StrokePath" stroke="#E91E63" d="M302.14,60.72C302.29,61.46 276.46,97.06 270.1,112.55C260.87,138.44 278.6,149.83 284.3,152.76C299.15,160.38 316.85,150.27 323.08,141.43C329.3,132.59 333.05,109.99 316.85,100.57C306.85,94.75 290.54,97.32 290.2,97.06C289.85,96.79 276.32,81.31 276.46,80.88C276.6,80.45 294.73,77.62 302.88,84.28C315.76,92.99 315.62,114.99 306.84,127.42C298.06,139.85 276.46,144.38 260.54,130.73C238.46,111.79 259.06,85.64 260.87,83.1C260.87,83.1 286.23,46.19 286.83,46.03C287.43,45.87 301.99,59.99 302.14,60.72Z" />
          <path id="io16_six_3" class="delightIconIo16StrokePath" stroke="#5C6BC0" d="M302.14,60.72C302.29,61.46 276.46,97.06 270.1,112.55C260.87,138.44 278.6,149.83 284.3,152.76C299.15,160.38 316.85,150.27 323.08,141.43C329.3,132.59 333.05,109.99 316.85,100.57C306.85,94.75 290.54,97.32 290.2,97.06C289.85,96.79 276.32,81.31 276.46,80.88C276.6,80.45 294.73,77.62 302.88,84.28C315.76,92.99 315.62,114.99 306.84,127.42C298.06,139.85 276.46,144.38 260.54,130.73C238.46,111.79 259.06,85.64 260.87,83.1C260.87,83.1 286.23,46.19 286.83,46.03C287.43,45.87 301.99,59.99 302.14,60.72Z" />
          <path id="io16_six_4" class="delightIconIo16StrokePath" stroke="#4DD0E1" d="M302.14,60.72C302.29,61.46 276.46,97.06 270.1,112.55C260.87,138.44 278.6,149.83 284.3,152.76C299.15,160.38 316.85,150.27 323.08,141.43C329.3,132.59 333.05,109.99 316.85,100.57C306.85,94.75 290.54,97.32 290.2,97.06C289.85,96.79 276.32,81.31 276.46,80.88C276.6,80.45 294.73,77.62 302.88,84.28C315.76,92.99 315.62,114.99 306.84,127.42C298.06,139.85 276.46,144.38 260.54,130.73C238.46,111.79 259.06,85.64 260.87,83.1C260.87,83.1 286.23,46.19 286.83,46.03C287.43,45.87 301.99,59.99 302.14,60.72Z" />
        </svg>
      </li>
    </ul>
    <div class="svgDemoCheckboxContainer">
      <label for="includes6_showTrimPathsCheckbox" class="mdl-checkbox mdl-js-checkbox mdl-js-ripple-effect">
        <input type="checkbox" id="includes6_showTrimPathsCheckbox" class="mdl-checkbox__input">
        <span class="mdl-checkbox__label">Show trim paths</span>
      </label>
      <label for="includes6_slowAnimationCheckbox" class="mdl-checkbox mdl-js-checkbox mdl-js-ripple-effect">
        <input type="checkbox" id="includes6_slowAnimationCheckbox" class="mdl-checkbox__input">
        <span class="mdl-checkbox__label">Slow animation</span>
      </label>
    </div>
  </div>
  <p class="mdl-typography--caption mdl-typography--text-center"><strong>Figure 6.</strong> Understanding how trimming stroked paths can be used to create icon animations. Android source code for each is available on GitHub: (a) <a href="https://github.com/alexjlockwood/adp-delightful-details/blob/master/app/src/main/res/drawable/asl_fingerprint.xml">fingerprint</a>, (b) <a href="https://github.com/alexjlockwood/adp-delightful-details/blob/master/app/src/main/res/drawable/asl_trimclip_searchback.xml">search to back arrow</a>, (c) <a href="https://github.com/alexjlockwood/adp-delightful-details/blob/master/app/src/main/res/drawable/avd_handwriting_android_design.xml">cursive handwriting</a>, and (d) <a href="https://github.com/alexjlockwood/adp-delightful-details/blob/master/app/src/main/res/drawable/avd_handwriting_io16.xml">Google IO 2016</a>. Click each icon to start its animation.</p>
</div>

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

<div>
  <div id="svgCircularProgressDemos" class="svgDemoContainer">
  <svg id="circular_progress" viewBox="0 0 48 48" style="max-width: 320px; max-height: 320px;">
    <g id="circular_progress_position" transform="translate(24,24)">
      <g id="circular_progress_outer_rotation">
        <g id="circular_progress_inner_rotation">
          <path id="circular_progress_circle_path_debug" d="M0,0 m 0,-18 a 18,18 0 1,1 0,36 a 18,18 0 1,1 0,-36" style="visibility: hidden;" stroke="#690" stroke-opacity="0.3" stroke-width="4" fill="none" />
          <path id="circular_progress_circle_path" d="M0,0 m 0,-18 a 18,18 0 1,1 0,36 a 18,18 0 1,1 0,-36" stroke="#690" stroke-width="4" stroke-dasharray="3.39292006587,109.704415463" fill="none" />
        </g>
      </g>
    </g>
  </svg>
  <div class="svgDemoCheckboxContainer">
    <label for="circularProgressOuterRotationCheckbox" class="mdl-checkbox mdl-js-checkbox mdl-js-ripple-effect">
      <input type="checkbox" id="circularProgressOuterRotationCheckbox" class="mdl-checkbox__input" checked>
      <span class="mdl-checkbox__label">Animate rotation</span>
    </label>
    <label for="circularProgressTrimPathOffsetCheckbox" class="mdl-checkbox mdl-js-checkbox mdl-js-ripple-effect">
      <input type="checkbox" id="circularProgressTrimPathOffsetCheckbox" class="mdl-checkbox__input" checked>
      <span class="mdl-checkbox__label">Animate trim path offset</span>
    </label>
    <label for="circularProgressTrimPathStartEndCheckbox" class="mdl-checkbox mdl-js-checkbox mdl-js-ripple-effect">
      <input type="checkbox" id="circularProgressTrimPathStartEndCheckbox" class="mdl-checkbox__input" checked>
      <span class="mdl-checkbox__label">Animate trim path start/end</span>
    </label>
    <label for="circularProgressShowTrimPathsCheckbox" class="mdl-checkbox mdl-js-checkbox mdl-js-ripple-effect">
      <input type="checkbox" id="circularProgressShowTrimPathsCheckbox" class="mdl-checkbox__input">
      <span class="mdl-checkbox__label">Show trim paths</span>
    </label>
    <label for="circularProgressSlowAnimationCheckbox" class="mdl-checkbox mdl-js-checkbox mdl-js-ripple-effect">
      <input type="checkbox" id="circularProgressSlowAnimationCheckbox" class="mdl-checkbox__input">
      <span class="mdl-checkbox__label">Slow animation</span>
    </label>
  </div>
</div>
  <p class="mdl-typography--caption mdl-typography--text-center"><strong>Figure 7.</strong> Understanding how rotation and a stroked trim path are used to animate a circular indeterminate progress indicator (<a href="https://github.com/alexjlockwood/adp-delightful-details/blob/master/app/src/main/res/drawable/avd_progress_indeterminate_circular.xml">source code</a>).</p>
</div>

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

<div>
  <div class="svgDemoContainer">
    <ul class="flex-container">
      <li class="flex-item">
        <svg id="ic_plus_minus" viewBox="0 0 24 24" class="svgDemoGraphic">
          <g transform="translate(12,12)">
            <g id="plus_minus_container_rotate">
              <g id="plus_minus_container_translate" transform="translate(-12,-12)">
                <path id="plus_minus_path" d="M5 11h6V5h2v6h6v2h-6v6h-2v-6H5z">
                  <animate id="plus_to_minus_path_animation" attributeName="d" begin="indefinite" dur="250ms" calcMode="spline" keyTimes="0;1" keySplines="0.4 0 0.2 1" fill="freeze" values="M 5,11 L 11,11 L 11,5 L 13,5 L 13,11 L 19,11 L 19,13 L 13,13 L 13,19 L 11,19 L 11,13 L 5,13 Z;M 5,11 L 11,11 L 11,11 L 13,11 L 13,11 L 19,11 L 19,13 L 13,13 L 13,13 L 11,13 L 11,13 L 5,13 Z" />
                  <animate id="minus_to_plus_path_animation" attributeName="d" begin="indefinite" dur="250ms" calcMode="spline" keyTimes="0;1" keySplines="0.4 0 0.2 1" fill="freeze" values="M 5,11 L 11,11 L 11,11 L 13,11 L 13,11 L 19,11 L 19,13 L 13,13 L 13,13 L 11,13 L 11,13 L 5,13 Z;M 5,11 L 11,11 L 11,5 L 13,5 L 13,11 L 19,11 L 19,13 L 13,13 L 13,19 L 11,19 L 11,13 L 5,13 Z" />
                </path>
                <path id="plus_minus_end_points_path" fill="#e00" style="visibility: hidden;">
                  <animate id="plus_minus_end_points_animation" attributeName="d" begin="indefinite" dur="250ms" calcMode="spline" keyTimes="0;1" keySplines="0.4 0 0.2 1" fill="freeze" />
                </path>
              </g>
            </g>
          </g>
        </svg>
      </li>
      <li class="flex-item">
        <svg id="ic_cross_tick" viewBox="0 0 24 24" class="svgDemoGraphic">
          <g transform="translate(12,12)">
            <g id="cross_tick_container_rotate">
              <g id="cross_tick_container_translate" transform="translate(-12,-12)">
                <path id="cross_tick_path" stroke="#000" stroke-width="2" stroke-linecap="square" d="M6.4 6.4l11.2 11.2m-11.2 0L17.6 6.4">
                  <animate id="cross_to_tick_path_animation" attributeName="d" begin="indefinite" dur="300ms" calcMode="spline" keyTimes="0;1" keySplines="0.4 0 0.2 1" fill="freeze" values="M6.4,6.4 L17.6,17.6 M6.4,17.6 L17.6,6.4;M4.8,13.4 L9,17.6 M10.4,16.2 L19.6,7" />
                  <animate id="tick_to_cross_path_animation" attributeName="d" begin="indefinite" dur="300ms" calcMode="spline" keyTimes="0;1" keySplines="0.4 0 0.2 1" fill="freeze" values="M4.8,13.4 L9,17.6 M10.4,16.2 L19.6,7;M6.4,6.4 L17.6,17.6 M6.4,17.6 L17.6,6.4" />
                </path>
                <path id="cross_tick_end_points_path" fill="#e00" style="visibility: hidden;">
                  <animate id="cross_tick_end_points_animation" attributeName="d" begin="indefinite" dur="300ms" calcMode="spline" keyTimes="0;1" keySplines="0.4 0 0.2 1" fill="freeze" />
                </path>
              </g>
            </g>
          </g>
        </svg>
      </li>
      <li class="flex-item">
        <svg id="ic_arrow_drawer" viewBox="0 0 24 24" class="svgDemoGraphic">
          <g transform="translate(12,12)">
            <g id="arrow_drawer_container_rotate">
              <g id="arrow_drawer_container_translate" transform="translate(-12,-12)">
                <path id="arrow_drawer_path" d="M 3,6 L 3,8 L 21,8 L 21,6 L 3,6 z M 3,11 L 3,13 L 21,13 L 21, 12 L 21,11 L 3,11 z M 3,18 L 3,16 L 21,16 L 21,18 L 3,18 z">
                  <animate id="drawer_to_arrow_path_animation" attributeName="d" begin="indefinite" dur="300ms" calcMode="spline" keyTimes="0;1" keySplines="0.4 0 0.2 1" fill="freeze" values="M 3,6 L 3,8 L 21,8 L 21,6 L 3,6 z M 3,11 L 3,13 L 21,13 L 21, 12 L 21,11 L 3,11 z M 3,18 L 3,16 L 21,16 L 21,18 L 3,18 z;M 12, 4 L 10.59,5.41 L 16.17,11 L 18.99,11 L 12,4 z M 4, 11 L 4, 13 L 18.99, 13 L 20, 12 L 18.99, 11 L 4, 11 z M 12,20 L 10.59, 18.59 L 16.17, 13 L 18.99, 13 L 12, 20z" />
                  <animate id="arrow_to_drawer_path_animation" attributeName="d" begin="indefinite" dur="300ms" calcMode="spline" keyTimes="0;1" keySplines="0.4 0 0.2 1" fill="freeze" values="M 12, 4 L 10.59,5.41 L 16.17,11 L 18.99,11 L 12,4 z M 4, 11 L 4, 13 L 18.99, 13 L 20, 12 L 18.99, 11 L 4, 11 z M 12,20 L 10.59, 18.59 L 16.17, 13 L 18.99, 13 L 12, 20z;M 3,6 L 3,8 L 21,8 L 21,6 L 3,6 z M 3,11 L 3,13 L 21,13 L 21, 12 L 21,11 L 3,11 z M 3,18 L 3,16 L 21,16 L 21,18 L 3,18 z" />
                </path>
                <path id="arrow_drawer_end_points_path" fill="#e00" style="visibility: hidden;">
                  <animate id="drawer_arrow_end_points_animation" attributeName="d" begin="indefinite" dur="300ms" calcMode="spline" keyTimes="0;1" keySplines="0.4 0 0.2 1" fill="freeze" />
                </path>
              </g>
            </g>
          </g>
        </svg>
      </li>
      <li class="flex-item">
        <svg id="ic_arrow_overflow" viewBox="0 0 24 24" class="svgDemoGraphic">
          <g transform="translate(12,12)">
            <g id="arrow_overflow_translate_dot3" transform="translate(0,6)">
              <g id="arrow_overflow_rotate_dot3">
                <g id="arrow_overflow_pivot_dot3">
                  <path id="arrow_overflow_path3" fill="#000" d="M 0,-2 l 0,0 c 1.05,0 2,0.895 2,2 l 0,0 c 0,1.05 -0.895,2 -2,2 l 0,0 c -1.05,0 -2,-0.895 -2,-2 l 0,0 c 0,-1.05 0.895,-2 2,-2 Z">
                    <animate id="overflow_to_arrow_path3_animation" attributeName="d" begin="indefinite" dur="300ms" calcMode="spline" keyTimes="0;0.25;0.5;0.75;1" keySplines="0 0 1 1;0 0 1 1;0 0 1 1;0 0 1 1" fill="freeze" />
                    <animate id="arrow_to_overflow_path3_animation" attributeName="d" begin="indefinite" dur="300ms" calcMode="spline" keyTimes="0;0.125;0.25;0.375;0.5;0.625;0.75;0.875;1" keySplines="0 0 1 1;0 0 1 1;0 0 1 1;0 0 1 1;0 0 1 1;0 0 1 1;0 0 1 1;0 0 1 1" fill="freeze" />
                  </path>
                  <path id="arrow_overflow_end_points_path3" style="visibility: hidden;" fill="#e00">
                    <animate id="arrow_overflow_end_points3_animation" attributeName="d" begin="indefinite" dur="300ms" calcMode="spline" fill="freeze" />
                  </path>
                </g>
              </g>
            </g>
            <g id="arrow_overflow_translate_dot1" transform="translate(0,-6)">
              <g id="arrow_overflow_rotate_dot1">
                <g id="arrow_overflow_pivot_dot1">
                  <path id="arrow_overflow_path1" fill="#000" d="M 0,-2 l 0,0 c 1.05,0 2,0.895 2,2 l 0,0 c 0,1.05 -0.895,2 -2,2 l 0,0 c -1.05,0 -2,-0.895 -2,-2 l 0,0 c 0,-1.05 0.895,-2 2,-2 Z">
                    <animate id="overflow_to_arrow_path1_animation" attributeName="d" begin="indefinite" dur="300ms" calcMode="spline" keyTimes="0;0.25;0.5;0.75;1" keySplines="0 0 1 1;0 0 1 1;0 0 1 1;0 0 1 1" fill="freeze" />
                    <animate id="arrow_to_overflow_path1_animation" attributeName="d" begin="indefinite" dur="300ms" calcMode="spline" keyTimes="0;0.125;0.25;0.375;0.5;0.625;0.75;0.875;1" keySplines="0 0 1 1;0 0 1 1;0 0 1 1;0 0 1 1;0 0 1 1;0 0 1 1;0 0 1 1;0 0 1 1" fill="freeze" />
                  </path>
                  <path id="arrow_overflow_end_points_path1" style="visibility: hidden;" fill="#e00">
                    <animate id="arrow_overflow_end_points1_animation" attributeName="d" begin="indefinite" dur="300ms" calcMode="spline" fill="freeze" />
                  </path>
                </g>
              </g>
            </g>
            <g id="arrow_overflow_translate_dot2">
              <g id="arrow_overflow_pivot_dot2">
                <path id="arrow_overflow_path2" fill="#000" d="M 0,-2 l 0,0 c 1.05,0 2,0.895 2,2 l 0,0 c 0,1.05 -0.895,2 -2,2 l 0,0 c -1.05,0 -2,-0.895 -2,-2 l 0,0 c 0,-1.05 0.895,-2 2,-2 Z">
                  <animate id="overflow_to_arrow_path2_animation" attributeName="d" begin="indefinite" dur="300ms" calcMode="spline" keyTimes="0;0.1667;0.3333;0.5;0.6666;0.83333;1" keySplines="0 0 1 1;0 0 1 1;0 0 1 1;0 0 1 1;0 0 1 1;0 0 1 1" fill="freeze" />
                  <animate id="arrow_to_overflow_path2_animation" attributeName="d" begin="indefinite" dur="300ms" calcMode="spline" keyTimes="0;0.125;0.25;0.375;0.5;0.625;0.75;0.875;1" keySplines="0 0 1 1;0 0 1 1;0 0 1 1;0 0 1 1;0 0 1 1;0 0 1 1;0 0 1 1;0 0 1 1" fill="freeze" />
                </path>
                <path id="arrow_overflow_end_points_path2" style="visibility: hidden;" fill="#e00">
                  <animate id="arrow_overflow_end_points2_animation" attributeName="d" begin="indefinite" dur="300ms" calcMode="spline" fill="freeze" />
                </path>
              </g>
            </g>
          </g>
        </svg>
      </li>
      <li class="flex-item">
        <svg id="ic_play_pause_stop" viewBox="0 0 18 18" class="svgDemoGraphic">
          <g id="play_pause_stop_translateX" transform="translate(0.75,0)">
            <g transform="translate(9,9)">
              <g id="play_pause_stop_rotate" transform="rotate(90)">
                <g transform="translate(-9,-9)">
                  <path id="play_pause_stop_path" d="M9 5v8H4l5-8m0 0l5 8H9V5">
                    <animate id="play_pause_stop_animation" fill="freeze" attributeName="d" begin="indefinite" dur="200ms" calcMode="spline" keyTimes="0;1" keySplines="0.4 0 0.2 1" />
                  </path>
                  <path id="play_pause_stop_end_points_path" style="visibility: hidden;" fill="#e00">
                    <animate id="play_pause_stop_end_points_animation" fill="freeze" attributeName="d" begin="indefinite" dur="200ms" calcMode="spline" keyTimes="0;1" keySplines="0.4 0 0.2 1" />
                  </path>
                </g>
              </g>
            </g>
          </g>
        </svg>
      </li>
      <li class="flex-item">
        <svg id="ic_countdown" viewBox="0 0 1 1" class="svgDemoGraphic">
          <g id="scale_container" transform="scale(0.8,0.8)">
            <g id="countdown_container" transform="translate(0.1,0.1)">
              <path id="countdown_digits" stroke="#000" stroke-width="0.02" fill="none" d="M.246.552C.246.332.37.1.552.1c.183 0 .31.23.31.452 0 .22-.127.442-.31.442C.37.994.246.774.246.552">
                <animate id="countdown_digits_animation" attributeName="d" begin="indefinite" dur="300ms" calcMode="spline" keyTimes="0;1" keySplines="0.4 0 0.2 1" fill="freeze" />
              </path>
              <path id="countdown_digits_cp1" style="visibility: hidden;" fill="#e00">
                <animate id="countdown_digits_cp1_animation" attributeName="d" begin="indefinite" dur="300ms" calcMode="spline" keyTimes="0;1" keySplines="0.4 0 0.2 1" fill="freeze" />
              </path>
              <path id="countdown_digits_cp2" style="visibility: hidden;" fill="#e00">
                <animate id="countdown_digits_cp2_animation" attributeName="d" begin="indefinite" dur="300ms" calcMode="spline" keyTimes="0;1" keySplines="0.4 0 0.2 1" fill="freeze" />
              </path>
              <path id="countdown_digits_end" style="visibility: hidden;" fill="#e00">
                <animate id="countdown_digits_end_animation" attributeName="d" begin="indefinite" dur="300ms" calcMode="spline" keyTimes="0;1" keySplines="0.4 0 0.2 1" fill="freeze" />
              </path>
            </g>
          </g>
        </svg>
      </li>
    </ul>
    <div class="svgDemoCheckboxContainer">
      <label for="pathMorphRotateCheckbox" class="mdl-checkbox mdl-js-checkbox mdl-js-ripple-effect">
        <input type="checkbox" id="pathMorphRotateCheckbox" class="mdl-checkbox__input" checked>
        <span class="mdl-checkbox__label">Animate rotation</span>
      </label>
      <label for="pathMorphShowPathPointsCheckbox" class="mdl-checkbox mdl-js-checkbox mdl-js-ripple-effect">
        <input type="checkbox" id="pathMorphShowPathPointsCheckbox" class="mdl-checkbox__input">
        <span class="mdl-checkbox__label">Show path coordinates</span>
      </label>
      <label for="pathMorphSlowAnimationCheckbox" class="mdl-checkbox mdl-js-checkbox mdl-js-ripple-effect">
        <input type="checkbox" id="pathMorphSlowAnimationCheckbox" class="mdl-checkbox__input">
        <span class="mdl-checkbox__label">Slow animation</span>
      </label>
    </div>
  </div>
  <p class="mdl-typography--caption mdl-typography--text-center"><strong>Figure 8.</strong> Understanding how path morphing can be used to create icon animations. Android source code for each is available on GitHub: (a)
    <a href="https://github.com/alexjlockwood/adp-delightful-details/blob/master/app/src/main/res/drawable/asl_pathmorph_plusminus.xml">plus to minus</a>, (b)
    <a href="https://github.com/alexjlockwood/adp-delightful-details/blob/master/app/src/main/res/drawable/asl_pathmorph_crosstick.xml">cross to tick</a>, (c)
    <a href="https://github.com/alexjlockwood/adp-delightful-details/blob/master/app/src/main/res/drawable/asl_pathmorph_drawer.xml">drawer to arrow</a>, (d)
    <a href="https://github.com/alexjlockwood/adp-delightful-details/blob/master/app/src/main/res/drawable/asl_pathmorph_arrowoverflow.xml">overflow to arrow</a>, (e)
    <a href="https://github.com/alexjlockwood/adp-delightful-details/blob/master/app/src/main/res/drawable/asl_playpausestop.xml">play to pause to stop</a>, and (f)
    <a href="https://github.com/alexjlockwood/adp-delightful-details/blob/master/app/src/main/res/drawable/asl_pathmorph_digits.xml">animating digits</a>. Click each icon to start its animation.</p>
</div>

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

<div>
  <div class="svgDemoContainer">
    <ul class="flex-container">
      <li class="flex-item">
        <svg id="ic_timer" viewBox="0 0 24 24" class="svgDemoGraphic">
          <g transform="translate(12,12)">
            <g id="hourglass_frame_rotation">
              <path d="M 1,0 c 0,0 6.29,-6.29 6.29,-6.29 c 0.63,-0.63 0.19,-1.71 -0.7,-1.71 c 0,0 -13.18,0 -13.18,0 c -0.89,0 -1.33,1.08 -0.7,1.71 c 0,0 6.29,6.29 6.29,6.29 c 0,0 -6.29,6.29 -6.29,6.29 c -0.63,0.63 -0.19,1.71 0.7,1.71 c 0,0 13.18,0 13.18,0 c 0.89,0 1.33,-1.08 0.7,-1.71 c 0,0 -6.29,-6.29 -6.29,-6.29 Z M -4.17,-6 c 0,0 8.34,0 8.34,0 c 0,0 -4.17,4.17 -4.17,4.17 c 0,0 -4.17,-4.17 -4.17,-4.17 Z M -4.17,6 c 0,0 4.17,-4.17 4.17,-4.17 c 0,0 4.17,4.17 4.17,4.17 c 0,0 -8.34,0 -8.34,0 Z" fill="#000000" />
            </g>
          </g>
          <g transform="translate(12,12)">
            <g id="hourglass_fill_rotation">
              <g transform="translate(-12,-12)">
                <clipPath id="hourglass_clip_mask">
                  <path d="M 24,13.4 c 0,0 -24,0 -24,0 c 0,0 0,10.6 0,10.6 c 0,0 24,0 24,0 c 0,0 0,-10.6 0,-10.6 Z">
                    <animate id="hourglass_clip_mask_animation" fill="freeze" attributeName="d" begin="indefinite" calcMode="spline" keyTimes="0;1" keySplines="0.4 0 0.2 1" values="M 24,13.4 c 0,0 -24,0 -24,0 c 0,0 0,10.6 0,10.6 c 0,0 24,0 24,0 c 0,0 0,-10.6 0,-10.6 Z;M 24,0 c 0,0 -24,0 -24,0 c 0,0 0,10.7 0,10.7 c 0,0 24,0 24,0 c 0,0 0,-10.7 0,-10.7 Z" />
                  </path>
                </clipPath>
                <g clip-path="url(#hourglass_clip_mask)">
                  <path d="M 13,12 c 0,0 6.29,-6.29 6.29,-6.29 c 0.63,-0.63 0.18,-1.71 -0.71,-1.71 c 0,0 -13.17,0 -13.17,0 c -0.89,0 -1.34,1.08 -0.71,1.71 c 0,0 6.29,6.29 6.29,6.29 c 0,0 -6.29,6.29 -6.29,6.29 c -0.63,0.63 -0.18,1.71 0.71,1.71 c 0,0 13.17,0 13.17,0 c 0.89,0 1.34,-1.08 0.71,-1.71 c 0,0 -6.29,-6.29 -6.29,-6.29 Z" fill="#000000" />
                </g>
                <path id="hourglass_clip_mask_debug" d="M 24,13.4 c 0,0 -24,0 -24,0 c 0,0 0,10.6 0,10.6 c 0,0 24,0 24,0 c 0,0 0,-10.6 0,-10.6 Z" fill="#F44336" fill-opacity="0.3" style="visibility: hidden;">
                  <animate id="hourglass_clip_mask_debug_animation" fill="freeze" attributeName="d" begin="indefinite" calcMode="spline" keyTimes="0;1" keySplines="0.4 0 0.2 1" values="M 24,13.4 c 0,0 -24,0 -24,0 c 0,0 0,10.6 0,10.6 c 0,0 24,0 24,0 c 0,0 0,-10.6 0,-10.6 Z;M 24,0 c 0,0 -24,0 -24,0 c 0,0 0,10.7 0,10.7 c 0,0 24,0 24,0 c 0,0 0,-10.7 0,-10.7 Z" />
                </path>
              </g>
            </g>
          </g>
        </svg>
      </li>
      <li class="flex-item">
        <svg id="ic_visibility" class="svgDemoGraphic" viewBox="0 0 24 24">
          <path id="cross_out_path" fill="none" stroke="#000" stroke-width="1.8" stroke-linecap="square" d="M3.27 4.27l16.47 16.47" />
          <clipPath id="eye_mask_clip_path">
            <path id="eye_mask" d="M2 4.27L19.73 22l2.54-2.54L4.54 1.73V1H23v22H1V4.27z">
              <animate id="eye_mask_animation" fill="freeze" attributeName="d" begin="indefinite" calcMode="spline" keyTimes="0;1" keySplines="0.4 0 0.2 1" />
            </path>
          </clipPath>
          <g id="eye_mask_clip_path_group" clip-path="url(#eye_mask_clip_path)">
            <path id="eye" d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
          </g>
          <path id="eye_mask_clip_path_debug" d="M2 4.27L19.73 22l2.54-2.54L4.54 1.73V1H23v22H1V4.27z" fill="#F44336" fill-opacity=".3" style="visibility: hidden;">
            <animate id="eye_mask_debug_animation" fill="freeze" attributeName="d" begin="indefinite" calcMode="spline" keyTimes="0;1" keySplines="0.4 0 0.2 1" />
          </path>
        </svg>
      </li>
      <li class="flex-item">
        <svg id="ic_heart" class="svgDemoGraphic" viewBox="0 0 56 56">
          <g transform="translate(28,28) scale(1.5,1.5) translate(-28,-28)">
            <path id="heart_stroke_left" fill="none" stroke="#000" stroke-width="2" d="M28.72 38.296l-3.05-2.744c-4.05-3.76-7.654-6.66-7.654-10.707 0-3.257 2.615-4.88 5.618-4.88 1.365 0 3.165 1.216 5.01 3.165" />
            <path id="heart_stroke_right" fill="none" stroke="#000" stroke-width="2" d="M27.23 38.294l3.535-3.094c4.07-3.965 6.987-6.082 7.24-10.116.163-2.625-2.232-5.05-4.626-5.05-2.948 0-3.708 1.013-6.15 3.1" />
            <clipPath id="heart_clip">
              <path id="heart_clip_path" d="M14 42 L42 42 L42 42 L14 42 Z">
                <animate id="heart_fill_animation" fill="freeze" attributeName="d" begin="indefinite" dur="300ms" calcMode="spline" keyTimes="0;1" keySplines="0.4 0 0.2 1" values="M14 42 L42 42 L42 42 L14 42 Z;M14 14 L42 14 L42 42 L14 42 Z" />
              </path>
            </clipPath>
            <g id="clip_path_group" clip-path="url(#heart_clip)">
              <path id="heart_full_path" fill="#000" style="visibility: hidden;" d="M28 39l-1.595-1.433C20.74 32.47 17 29.11 17 24.995 17 21.632 19.657 19 23.05 19c1.914 0 3.75.883 4.95 2.272C29.2 19.882 31.036 19 32.95 19c3.393 0 6.05 2.632 6.05 5.995 0 4.114-3.74 7.476-9.405 12.572L28 39z" />
            </g>
            <g id="broken_heart_left_group" transform="translate(28,37.3)">
              <g id="broken_heart_rotate_left_group">
                <g id="broken_heart_translate_left_group" transform="translate(-28,-37.3)">
                  <path id="broken_heart_left_path" fill-opacity="0" d="M28.03 21.054l-.03.036C26.91 19.81 25.24 19 23.5 19c-3.08 0-5.5 2.42-5.5 5.5 0 3.78 3.4 6.86 8.55 11.53L28 37.35l.002-.002-.22-.36.707-.915-.984-1.31 1.276-1.736-1.838-2.02 2.205-2.282-2.033-1.582 2.032-2.125-2.662-2.04 1.543-1.924z" />
                </g>
              </g>
            </g>
            <g id="broken_heart_right_group" transform="translate(28,37.3)">
              <g id="broken_heart_rotate_right_group">
                <g id="broken_heart_translate_right_group" transform="translate(-28,-37.3)">
                  <path id="broken_heart_right_path" fill-opacity="0" d="M28.03 21.054c.14-.16.286-.31.44-.455l.445-.374C29.925 19.456 31.193 19 32.5 19c3.08 0 5.5 2.42 5.5 5.5 0 3.78-3.4 6.86-8.55 11.54l-1.448 1.308-.22-.36.707-.915-.984-1.31 1.276-1.736-1.838-2.02 2.205-2.282-2.033-1.582 2.032-2.125-2.662-2.04 1.543-1.924z" />
                </g>
              </g>
            </g>
            <path id="heart_clip_path_debug" style="visibility: hidden;" d="M14 42 L42 42 L42 42 L14 42 Z" fill="#F44336" fill-opacity="0.3">
              <animate id="heart_fill_debug_animation" fill="freeze" attributeName="d" begin="indefinite" dur="300ms" calcMode="spline" keyTimes="0;1" keySplines="0.4 0 0.2 1" values="M14 42 L42 42 L42 42 L14 42 Z;M14 14 L42 14 L42 42 L14 42 Z" />
            </path>
          </g>
        </svg>
      </li>
    </ul>
    <div class="svgDemoCheckboxContainer">
      <label for="clipPathShowClipMaskCheckbox" class="mdl-checkbox mdl-js-checkbox mdl-js-ripple-effect">
        <input type="checkbox" id="clipPathShowClipMaskCheckbox" class="mdl-checkbox__input">
        <span class="mdl-checkbox__label">Show clip paths</span>
      </label>
      <label for="clipPathSlowAnimationCheckbox" class="mdl-checkbox mdl-js-checkbox mdl-js-ripple-effect">
        <input type="checkbox" id="clipPathSlowAnimationCheckbox" class="mdl-checkbox__input">
        <span class="mdl-checkbox__label">Slow animation</span>
      </label>
    </div>
  </div>
  <p class="mdl-typography--caption mdl-typography--text-center"><strong>Figure 9.</strong> Understanding how <code>&lt;clip-path&gt;</code>s can be used to create icon animations. Android source code for each is available on GitHub: (a) <a href="https://github.com/alexjlockwood/adp-delightful-details/blob/master/app/src/main/res/drawable/avd_clock_timer.xml">hourglass</a>, (b) <a href="https://github.com/alexjlockwood/adp-delightful-details/blob/master/app/src/main/res/drawable/asl_trimclip_eye.xml">eye visibility</a>, and (c) <a href="https://github.com/alexjlockwood/adp-delightful-details/blob/master/app/src/main/res/drawable/asl_trimclip_heart.xml">heart fill/break</a>. Click each icon to start its animation.</p>
</div>

### Conclusion: putting it all together

If you've made it this far in the blog post, that means you now have all of the fundamental building blocks you need in order to design your own icon animations from scratch! To celebrate, let's finish off this ridiculously enormous blog post once and for all with one last kickass example! Consider the progress icon in **Figure 10**, which animates the following six properties:

1. Fill alpha (at the end when fading out the downloading arrow).
2. Stroke width (during the progress indicator to check mark animation).
3. Translation and rotation (at the beginning to create the 'bouncing arrow' effect).
4. Trim path start/end (at the end when transitioning from the progress bar to the check mark).
5. Path morphing (at the beginning to create the 'bouncing line' effect, and at the end while transitioning the check mark back into an arrow).
6. Clip path (vertically filling the contents of the downloading arrow to indicate indeterminate progress).

<div id="includes10">
  <div class="svgDemoContainer">
    <svg id="ic_downloading" viewBox="0 0 240 240" style="max-width: 320px; max-height: 320px;">
      <g transform="translate(120,120)">
        <g transform="scale(0.91,0.91)">
          <g id="downloading_progress_bar_outer_rotation">
            <g id="downloading_progress_bar_inner_rotation">
              <path id="downloading_progress_bar" fill="none" stroke="#000" stroke-opacity="0" stroke-linecap="square" stroke-linejoin="miter" stroke-width="20" d="M 0,-120 a 120,120 0 1,1 0,240 a 120,120 0 1,1 0,-240" />
              <path id="downloading_progress_bar_check" transform="translate(-120,-120)" fill="none" stroke="#000" stroke-opacity="0" stroke-width="20" stroke-linecap="square" stroke-linejoin="miter" d="M 120,0 a 120,120 0 1,1 0,240 a 120,120 0 1,1 0,-240 C 224,30 162,83 162,83 L 106.5,138.5 L 80.45,112.45" />
              <path id="downloading_progress_bar_check_debug" transform="translate(-120,-120)" fill="none" stroke="#000" stroke-opacity="0.3" style="visibility: hidden;" stroke-width="20" stroke-linecap="square" stroke-linejoin="miter" d="M 120,0 a 120,120 0 1,1 0,240 a 120,120 0 1,1 0,-240 C 224,30 162,83 162,83 L 106.5,138.5 L 80.45,112.45" />
            </g>
          </g>
        </g>
      </g>
      <g transform="translate(120,120)">
        <g transform="scale(0.65,0.65)">
          <g transform="translate(-120,-120)">
            <path id="downloading_line_path" fill="none" stroke="#000" stroke-width="20" d="M 50,190 c 0,0 47.6596,0 70,0 c 22.3404,0 70,0 70,0">
              <animate id="downloading_line_path_animation" attributeName="d" begin="indefinite" calcMode="spline" keyTimes="0;0.5126;0.62885;0.8375;1" keySplines="0 0 1 1;0 0 1 1;0 0 1 1;0 0 1 1" fill="freeze" values="M 50,190 c 0,0 47.66,0 70,0 c 22.34,0 70,0 70,0;M 50,190 c 0,0 47.66,0 70,0 c 22.34,0 70,0 70,0;M 50,190 c 0,0 32.34,19.79 70,19.79 c 37.66,0 70,-19.79 70,-19.79;M 50,190 c 0,0 26.45,-7.98 69.67,-7.98 c 43.21,0 70.33,7.98 70.33,7.98;M 50,190 c 0,0 47.66,0 70,0 c 22.34,0 70,0 70,0" />
            </path>
            <path id="downloading_line_points_path" fill="#e00" style="visibility: hidden;">
              <animate id="downloading_line_points_path_animation" attributeName="d" begin="indefinite" calcMode="spline" keyTimes="0;0.5126;0.62885;0.8375;1" keySplines="0 0 1 1;0 0 1 1;0 0 1 1;0 0 1 1" fill="freeze" />
            </path>
            <g id="downloading_arrow_group_translate">
              <g transform="translate(120, 180)">
                <g id="downloading_arrow_group_rotate">
                  <g transform="translate(-120, -180)">
                    <path id="downloading_arrow_path" fill="#4d4d4d" d="M 190,90 c 0,0 -40,0 -40,0 c 0,0 0,-60 0,-60 c 0,0 -60,0 -60,0 c 0,0 0,60 0,60 c 0,0 -40,0 -40,0 c 0,0 70,70 70,70 c 0,0 70,-70 70,-70 Z" />
                    <clipPath id="downloading_arrow_fill_clip">
                      <path id="downloading_arrow_clip_path" d="M 0,0 L 240,0 L 240,240 L 0,240 L 0,0 Z">
                        <animate id="downloading_arrow_fill_clip_animation" fill="freeze" attributeName="d" begin="indefinite" calcMode="spline" keyTimes="0;1" keySplines="0.4 0 0.2 1" values="M 0,0 L 240,0 L 240,0 L 0,0 L 0,0 Z;M 0,0 L 240,0 L 240,240 L 0,240 L 0,0 Z" repeatCount="indefinite" />
                      </path>
                    </clipPath>
                    <g clip-path="url(#downloading_arrow_fill_clip)">
                      <path id="downloading_arrow_filling" fill="#000" d="M 190,90 c 0,0 -40,0 -40,0 c 0,0 0,-60 0,-60 c 0,0 -60,0 -60,0 c 0,0 0,60 0,60 c 0,0 -40,0 -40,0 c 0,0 70,70 70,70 c 0,0 70,-70 70,-70 Z" />
                    </g>
                    <path id="downloading_arrow_fill_clip_debug" d="M 0,0 L 240,0 L 240,240 L 0,240 L 0,0 Z" fill="#F44336" fill-opacity="0.3" style="visibility: hidden;">
                      <animate id="downloading_arrow_fill_clip_animation_debug" fill="freeze" attributeName="d" begin="indefinite" calcMode="spline" keyTimes="0;1" keySplines="0.4 0 0.2 1" values="M 0,0 L 240,0 L 240,0 L 0,0 L 0,0 Z;M 0,0 L 240,0 L 240,240 L 0,240 L 0,0 Z" repeatCount="indefinite" />
                    </path>
                  </g>
                </g>
              </g>
              <g id="downloading_check_arrow_group_translate" transform="translate(94,153)">
                <g id="downloading_check_arrow_group_rotate" transform="rotate(45)">
                  <g transform="translate(-120,-164)">
                    <path id="downloading_check_arrow_path" fill="#000" fill-opacity="0" d="M 129.12,164 c 0,0 0.88,0 0.88,0 c 0,0 0,-134 0,-134 c 0,0 -20,0 -20,0 c 0,0 -0.1,114.38 -0.1,114.38 c 0,0 -51.8,-0.13 -51.8,-0.13 c 0,0 0.01,19.87 0.01,19.87 c 0,0 68.02,-0.11 68.02,-0.11 c 0,0 2.98,0 2.98,0 Z">
                      <animate id="downloading_check_arrow_path_animation" begin="indefinite" attributeName="d" calcMode="spline" values="M 129.12,164 c 0,0 0.88,0 0.88,0 c 0,0 0,-134 0,-134 c 0,0 -20,0 -20,0 c 0,0 -0.1,114.38 -0.1,114.38 c 0,0 -51.8,-0.13 -51.8,-0.13 c 0,0 0.01,19.87 0.01,19.87 c 0,0 68.02,-0.11 68.02,-0.11 c 0,0 2.98,0 2.98,0 Z;M 129.12,164 c 0,0 0.88,0 0.88,0 c 0,0 0,-134 0,-134 c 0,0 -20,0 -20,0 c 0,0 -0.1,114.38 -0.1,114.38 c 0,0 0,-0.02 0,-0.02 c 0,0 0.01,19.87 0.01,19.87 c 0,0 18.4,-0.21 18.4,-0.21 c 0,0 0.81,-0.01 0.81,-0.01 Z;M 119.5,164 c 0,0 10.5,0 10.5,0 c 0,0 0,-134 0,-134 c 0,0 -20,0 -20,0 c 0,0 0,134 0,134 c 0,0 9.5,0 9.5,0 c 0,0 0,0 0,0 c 0,0 0,0 0,0 c 0,0 0,0 0,0 Z;M 119.5,90 c 0,0 30.5,0 30.5,0 c 0,0 0,-60 0,-60 c 0,0 -60,0 -60,0 c 0,0 0,60 0,60 c 0,0 29.5,0 29.5,0 c 0,0 0,0 0,0 c 0,0 0,0 0,0 c 0,0 0,0 0,0 Z;M 119.5,90 c 0,0 30.5,0 30.5,0 c 0,0 0,-60 0,-60 c 0,0 -60,0 -60,0 c 0,0 0,60 0,60 c 0,0 29.5,0 29.5,0 c 0,0 0,0 0,0 c 0,0 0,0 0,0 c 0,0 0,0 0,0 Z;M 190,90 c 0,0 -40,0 -40,0 c 0,0 0,-60 0,-60 c 0,0 -60,0 -60,0 c 0,0 0,60 0,60 c 0,0 -40,0 -40,0 c 0,0 70,70 70,70 c 0,0 70,-70 70,-70 c 0,0 0,0 0,0 Z" keyTimes="0; 0.12; 0.14; 0.34; 0.64; 1" keySplines="0.536 0 0.8333 0.73855; 0 0 0.6666 1; 0.2854 0.4477 0.0099875 1; 0 0 0.16846 1; 0.06557 0 0 1" fill="freeze" />
                    </path>
                    <path id="downloading_check_arrow_points_path" fill="#e00" fill-opacity="0" style="visibility: hidden;">
                      <animate id="downloading_check_arrow_points_path_animation" begin="indefinite" attributeName="d" calcMode="spline" keyTimes="0; 0.12; 0.14; 0.34; 0.64; 1" keySplines="0.536 0 0.8333 0.73855; 0 0 0.6666 1; 0.2854 0.4477 0.0099875 1; 0 0 0.16846 1; 0.06557 0 0 1" fill="freeze" />
                    </path>
                  </g>
                </g>
                <animateMotion id="downloading_check_arrow_path_motion_animation" begin="indefinite" calcMode="spline" path="M 0,0 c 4.02083,10.83333 20.66667,12.16667 26.0,11" keyPoints="0;1" keyTimes="0;1" keySplines="0.15324408203 0 0 1;" fill="freeze" />
              </g>
            </g>
          </g>
        </g>
      </g>
    </svg>
    <div class="svgDemoCheckboxContainer">
      <label for="includes10_showPathPointsCheckbox" class="mdl-checkbox mdl-js-checkbox mdl-js-ripple-effect">
        <input type="checkbox" id="includes10_showPathPointsCheckbox" class="mdl-checkbox__input">
        <span class="mdl-checkbox__label">Show path coordinates</span>
      </label>
      <label for="includes10_showTrimPathsCheckbox" class="mdl-checkbox mdl-js-checkbox mdl-js-ripple-effect">
        <input type="checkbox" id="includes10_showTrimPathsCheckbox" class="mdl-checkbox__input">
        <span class="mdl-checkbox__label">Show trim paths</span>
      </label>
      <label for="includes10_showClipMaskCheckbox" class="mdl-checkbox mdl-js-checkbox mdl-js-ripple-effect">
        <input type="checkbox" id="includes10_showClipMaskCheckbox" class="mdl-checkbox__input">
        <span class="mdl-checkbox__label">Show clip paths</span>
      </label>
      <label for="includes10_slowAnimationCheckbox" class="mdl-checkbox mdl-js-checkbox mdl-js-ripple-effect">
        <input type="checkbox" id="includes10_slowAnimationCheckbox" class="mdl-checkbox__input">
        <span class="mdl-checkbox__label">Slow animation</span>
      </label>
    </div>
  </div>
  <p class="mdl-typography--caption mdl-typography--text-center"><strong>Figure 10.</strong> A downloading progress icon animation that demonstrates a combination of several techniques discussed in this blog post. Android source code is available on GitHub: (a) <a href="https://github.com/alexjlockwood/adp-delightful-details/blob/master/app/src/main/res/drawable/avd_downloading_begin.xml">in-progress download</a> and (b) <a href="https://github.com/alexjlockwood/adp-delightful-details/blob/master/app/src/main/res/drawable/avd_downloading_finish.xml">download complete</a>. Click the icon to start its animation.</p>
</div>

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
