[Creative customization][creative-customization] is one of the tenets of material design; the subtle addition of an icon animation can add an element of wonder to the user experience, making your app feel more natural and alive. Unfortunately, building an icon animation from scratch using `VectorDrawable`s can be challenging. Not only does it take a fair amount of work to implement, but it also requires a vision of how the final result should look and feel. If you aren't familiar with the different techniques that are most often used to create icon animations, you're going to have a hard time designing your own.

This blog post covers several different techniques that you can use to create beautiful icon animations. The best way to learn is by example, so as you read through the post you'll encounter interactive demos highlighting how each technique works. I hope this blog post can at the very least open your eyes to how icon animations behave under-the-hood, because I genuinely believe that understanding how they work is the first step towards creating your own.

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
