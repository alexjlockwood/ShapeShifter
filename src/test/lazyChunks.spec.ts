// @vitest-environment node

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// The canvas editor is a chunk of its own, so that it doesn't delay the app's first render, which
// only works if nothing outside it imports it statically: that would bundle it with the rest of
// the app. Checks that only components/canvas/loadCanvasEditor.ts refers to it, with a dynamic import.

const SRC = fileURLToPath(new URL('..', import.meta.url));
const EDITOR_DIR = join(SRC, 'app/modules/editor/components/canvaseditor');
const LOADER = join(SRC, 'app/modules/editor/components/canvas/loadCanvasEditor.ts');

const files = readdirSync(SRC, { recursive: true, encoding: 'utf8' })
  .filter(file => /\.tsx?$/.test(file))
  .map(file => join(SRC, file))
  .filter(file => !file.startsWith(EDITOR_DIR + '/'));

/** Returns the module specifiers in the file, and whether each is a dynamic import. */
function findImports(file: string) {
  const code = readFileSync(file, 'utf8');
  const imports = Array.from(code.matchAll(/\b(?:from|import)\s*(\()?\s*['"]([^'"]+)['"]/g));
  return imports.map(([, paren, specifier]) => ({ specifier, isDynamic: !!paren }));
}

function resolveSpecifier(file: string, specifier: string) {
  if (specifier.startsWith('.')) {
    return resolve(dirname(file), specifier);
  }
  return /^(app|environments|test)\//.test(specifier) ? join(SRC, specifier) : specifier;
}

const isEditor = (path: string) => path === EDITOR_DIR || path.startsWith(EDITOR_DIR + '/');

it('finds the loader and the code outside the editor', () => {
  expect(files).toContain(LOADER);
  expect(files.length).toBeGreaterThan(100);
});

it('only loads the canvas editor dynamically, from loadCanvasEditor.ts', () => {
  const offenders = files.flatMap(file =>
    findImports(file)
      .filter(({ specifier }) => isEditor(resolveSpecifier(file, specifier)))
      .filter(({ isDynamic }) => !isDynamic || file !== LOADER)
      .map(({ specifier }) => `${relative(SRC, file)} imports ${specifier}`),
  );
  expect(offenders).toEqual([]);
});

it('finds the dynamic import in the loader', () => {
  const imports = findImports(LOADER).filter(({ specifier }) =>
    isEditor(resolveSpecifier(LOADER, specifier)),
  );
  expect(imports).toEqual([{ specifier: expect.any(String), isDynamic: true }]);
});
