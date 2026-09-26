// @vitest-environment node

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Checks that the files and directories named in the agent instructions (AGENTS.md files and
// project skills) still exist, so that the instructions don't point agents at code that has
// moved or been deleted. Also checks that there's no CLAUDE.md, which would hide them from Claude
// Code.

const ROOT = fileURLToPath(new URL('../..', import.meta.url));

// Paths in code spans may be written relative to the doc itself, the repo root, src/ (like the
// app's non-relative imports), or the editor module (like BUGS.md).
const BASES = ['', 'src', 'src/app/modules/editor'];

// Paths the docs may name that don't need to exist: generated directories, and CLAUDE.md, which
// the docs say not to add.
const EXEMPT = new Set(['CLAUDE.md', 'dist/', 'node_modules/', 'test-results/', 'tmp/']);

// A file name, as opposed to e.g. `.tsx` or `window.shapeshifter`.
const FILE_NAME =
  /\w\.(css|html|js|json|md|mjs|png|scss|sh|svg|ts|tsx|xml|yaml|yml)$|\/[\w.-]+\.shapeshifter$/;

// The repo's files, including new ones that haven't been added yet, but not ignored ones (like a
// personal CLAUDE.local.md).
const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], {
  cwd: ROOT,
  encoding: 'utf8',
})
  .split('\n')
  .filter(file => file && existsSync(join(ROOT, file)));

const docs = files.filter(
  file => /(^|\/)AGENTS\.md$/.test(file) || /^\.claude\/skills\/[^/]+\/SKILL\.md$/.test(file),
);

/** Returns the paths in a doc's code spans, and the targets of its relative links. */
function findReferences(doc: string) {
  const text = readFileSync(join(ROOT, doc), 'utf8');
  // Code spans can be commands or URLs, so check each word, e.g. the spec in
  // `npx playwright test e2e/app.spec.ts` and the demo in `/?project=demos/x.shapeshifter`.
  const words = Array.from(text.matchAll(/`([^`]+)`/g), match => match[1])
    .flatMap(span => span.split(/\s+/))
    .map(word => word.replace(/^\/\?project=/, 'public/'));
  const paths = words.filter(
    word =>
      /^[\w.-]+(\/[\w.-]+)*\/?$/.test(word) &&
      !word.includes('...') &&
      !EXEMPT.has(word) &&
      // A word is only a path if it names a file, ends with a slash like the docs' directory
      // names, or starts with a directory that exists (so that e.g. `origin/master` isn't
      // mistaken for one).
      (FILE_NAME.test(word) ||
        word.endsWith('/') ||
        (word.includes('/') && candidates(doc, word.split('/')[0]).some(existsSync))),
  );
  const links = Array.from(text.matchAll(/\]\(([^)\s#]+)(#[^)]*)?\)/g), match => match[1]).filter(
    link => !/^[a-z]+:/.test(link),
  );
  return { paths, links };
}

function candidates(doc: string, path: string) {
  return [dirname(doc), ...BASES].map(base => join(ROOT, base, path));
}

it('finds the root AGENTS.md and the paths in it', () => {
  expect(docs).toContain('AGENTS.md');
  expect(findReferences('AGENTS.md').paths.length).toBeGreaterThan(0);
});

it("doesn't have a CLAUDE.md", () => {
  // Claude Code doesn't read an AGENTS.md that has one of these next to it, or any AGENTS.md when
  // there's one at the root.
  const claudeFiles = files.filter(file => /(^|\/)(\.claude\/)?CLAUDE(\.local)?\.md$/.test(file));
  expect(claudeFiles, 'Put instructions in AGENTS.md instead').toEqual([]);
});

it.each(docs)('%s only names files that exist', doc => {
  const { paths, links } = findReferences(doc);
  const missingPaths = paths.filter(path => !candidates(doc, path).some(existsSync));
  expect(
    missingPaths,
    `${doc} names paths that don't exist relative to it, the repo root, src/, or src/app/modules/editor/`,
  ).toEqual([]);
  // Links are resolved relative to the doc, like GitHub does.
  const missingLinks = links.filter(link => !existsSync(join(ROOT, dirname(doc), link)));
  expect(missingLinks, `${doc} links to files that don't exist relative to it`).toEqual([]);
});
