# Import bugs found by the 2026-09-25 sweep

- **A `<use>` inside `<clipPath>` is deleted by svgo, so Illustrator clip groups import
  invisible.** Illustrator writes every clipping mask as a `<clipPath>` holding a `<use>`. svgo
  turns the `<use>` into a `<g>`, which isn't allowed in a `<clipPath>` and is removed, and an
  empty clip path clips everything, so the artwork imports blank. Inside a `<clipPath>`, insert the
  referenced shape with its transform instead of a `<g>`
  (`scripts/svgo/plugins/replaceUseElems.ts`). (IMP-1, high, confirmed by a test)
- **SVG `opacity` on paths and groups is ignored.** Only the root's `opacity` is read, so Material
  two-tone icons (`<path opacity=".3">`) and groups with an opacity from Figma and Sketch import
  fully opaque. Multiply the element's and its ancestors' opacity into `fillAlpha` and
  `strokeAlpha` (`scripts/import/SvgLoader.ts`). (IMP-2, medium, confirmed by a test)
- **VectorDrawable color references are dropped, so Android Studio icons import with no fill.**
  Vector Asset Studio icons use `android:fillColor="@android:color/white"`, and `getColor` returns
  `''` for anything that isn't a hex color, so they import invisible and report success. Map the
  common `@android:color/` values, and fall back to an opaque color for other references
  (`scripts/import/VectorDrawableLoader.ts`, `getColor`). (IMP-3, medium, confirmed by a test)
- **Unrendered SVG elements outside `<defs>` become layers.** A `<clipPath>`, `<mask>`,
  `<symbol>`, gradient, or `<text>` outside `<defs>`, which Illustrator writes, imports as layers:
  clip path, mask, and symbol content as visible paths, and the rest as empty groups. Skip every
  element that isn't a group or a shape (`scripts/import/SvgLoader.ts`). (IMP-4, medium, confirmed
  by a test)
- **Fractional viewBox sizes are truncated, cropping the content.** Inkscape's millimeter
  documents have viewBoxes like `0 0 16.933333 16.933333`, which import as 16x16 and cut off about
  6% at the right and bottom. Round the size up, or scale the content to fit
  (`scripts/import/SvgLoader.ts`, `scripts/import/VectorDrawableLoader.ts`). (IMP-5, low,
  confirmed by a test)
- **SVGs without `xmlns` import as empty groups and report success.** SVG copied from a web page,
  for example with DevTools' "Copy element", often has no `xmlns`, so paths become empty groups,
  the viewBox is ignored, and the import still reports success. Add the namespace before parsing
  when it's missing (`scripts/import/SvgLoader.ts`). (IMP-6, low, confirmed by a test)
- **Imported clip path transforms are composed in the wrong order.** A clip path's own transform
  and its child's transform are reversed and concatenated child-first, so anything but a
  translation (which commutes) lands in the wrong place
  (`scripts/import/SvgLoader.ts`, `buildPathInfosForClipPath`). (IMP-7, confirmed by a test; a
  candidate fix exists on the unmerged `alex/fix-sweep-quick-wins` branch, needs a rebase before
  reuse)
- **Bad `clip-path` references hide the element or fail the whole import.** A `clip-path` pointing
  at a missing id hides the element, where browsers draw it unclipped. A missing id inside a clip
  path, or clip paths that reference each other, fail the whole import, and a quoted `url('#c')`
  is ignored. Ignore unresolved references, guard against cycles, and accept quotes
  (`scripts/import/SvgLoader.ts`, `getReferencedClipPathId`). (IMP-8, low, confirmed by a test)
- **`<use>` outside `<defs>`, `<symbol>`, and nested `<svg>` positioning are mishandled.** A
  `<use>` of an element outside `<defs>` loses its copy, a used `<symbol>` imports nothing, and a
  nested `<svg>` with a position and a viewBox imports as a plain group, in the wrong place and at
  the wrong size. Resolve `<use>` against any id, and treat symbols and nested SVGs as viewports
  (`scripts/svgo/plugins/replaceUseElems.ts`, `scripts/import/SvgLoader.ts`). (IMP-9, low,
  confirmed by a test)
- **Non-ASCII ids give layers empty names.** `sanitize` strips every character of an id like
  Chinese, Japanese, or Russian Illustrator and Sketch exports use, and the prefix fallback isn't
  applied afterward, so layers are named `""`, `"_1"`, `"_2"`, and exports write
  `android:name=""` (`scripts/import/SvgLoader.ts`, `scripts/import/VectorDrawableLoader.ts`,
  `makeFinalNodeIdFn`). (IMP-10, confirmed by a test; a candidate fix exists on the unmerged
  `alex/fix-sweep-quick-wins` branch, needs a rebase before reuse)
- **Percentage values import as NaN.** `fill-opacity="50%"` or `stroke-width="5%"` imports as
  `NaN`, which is kept and exported. Parse percentages, and use the default for values that aren't
  finite (`scripts/import/SvgLoader.ts`). (IMP-11, low, confirmed by a test)
- **`.shapeshifter` import keeps duplicate layer ids.** Files saved on the live site before the
  Cmd+G fix under "Fixed during the migration" can have two layers with the same id, and both get
  the same new id on import, so selecting, deleting, and animating them stays ambiguous. Assign
  new ids per node while walking the tree (`scripts/common/ModelUtil.ts`, `regenerateModelIds`).
  (IMP-12, low, confirmed by a test)
- **Project files with unsanitized layer names can end up with duplicate names.**
  `FileExportService.fromJSON` doesn't sanitize the layer names it reads back, so a hand-edited
  `.shapeshifter` file can have names that collide once the name field's own sanitizing runs on
  the next edit (for example, layers "Circle" and "circle" both becoming "circle"), and the SVG
  export's clip path id scheme (see EXP-3 in `docs/bugs/export.md`) assumes names are already
  sanitized (`services/fileexport.service.ts`). (found reviewing the quick-wins fixes, not fixed;
  only affects hand-edited project files)
- **Some files in a multi-file import silently stall the batch.** If one of several dropped files
  is a type no branch handles, or a `.shapeshifter` file, the batch never finishes and the other
  files are silently dropped. The VectorDrawable loader also accepts any XML, so an AVD or a layout
  file "imports" as groups. Count unsupported files as errors, and require a `<vector>` root
  (`services/fileimport.service.ts`, `scripts/import/VectorDrawableLoader.ts`). (IMP-13, low,
  confirmed by reading, and the XML cases by a test)
- **A slow `?project=` fetch can overwrite work done in the meantime.** On a slow connection, if
  you open `/?project=...` and then open a file or a demo before it loads, the late project
  replaces your work without a prompt, since the fetch is only aborted on unmount. Abort it, or
  ignore its result, once anything else is loaded (`components/root/Root.tsx`). (IMP-14, low,
  plausible)
