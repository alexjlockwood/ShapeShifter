// @vitest-environment node

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Checks that the files and directories named in the agent instructions (AGENTS.md files and
// project skills) still exist, so that the instructions don't point agents at code that has
// moved or been deleted. Also checks that there's no CLAUDE.md, which would hide them from Claude
// Code.

const ROOT = fileURLToPath(new URL('../..', import.meta.url));

// Paths in the docs may be written relative to the doc itself, the repo root, src/ (like the
// app's non-relative imports), or the editor module (like BUGS.md).
const BASES = ['', 'src', 'src/app/modules/editor'];

// Paths the docs may name that don't need to exist: generated directories, and CLAUDE.md, which
// the docs say not to add.
const EXEMPT = new Set(['CLAUDE.md', 'dist/', 'node_modules/', 'test-results/', 'tmp/']);

const SKIPPED_DIRS = new Set(['node_modules', 'dist', 'test-results', 'playwright-report', 'tmp']);

// A file name, as opposed to e.g. `.tsx` or `window.shapeshifter`.
const FILE_NAME = /\w\.(css|html|js|json|md|mjs|png|scss|sh|svg|ts|tsx|xml|yaml|yml)$/;

/** Returns the repo's directories, except for dot directories, dependencies, and build output. */
function findDirs(dir = ''): string[] {
  const subdirs = readdirSync(join(ROOT, dir), { withFileTypes: true })
    .filter(
      entry => entry.isDirectory() && !entry.name.startsWith('.') && !SKIPPED_DIRS.has(entry.name),
    )
    .map(entry => join(dir, entry.name));
  return [dir, ...subdirs.flatMap(subdir => findDirs(subdir))];
}

function findSkills() {
  const skillsDir = join(ROOT, '.claude/skills');
  if (!existsSync(skillsDir)) {
    return [];
  }
  return readdirSync(skillsDir)
    .map(name => join('.claude/skills', name, 'SKILL.md'))
    .filter(path => existsSync(join(ROOT, path)));
}

/** Returns the paths in a doc's code spans and relative links. */
function findReferences(doc: string) {
  const text = readFileSync(join(ROOT, doc), 'utf8');
  const codeSpans = Array.from(text.matchAll(/`([^`\s]+)`/g), match => match[1]);
  const links = Array.from(text.matchAll(/\]\(([^)\s#]+)(#[^)]*)?\)/g), match => match[1]);
  const pathLike = codeSpans.filter(
    span =>
      /^[\w.-]+(\/[\w.-]+)*\/?$/.test(span) &&
      !span.includes('...') &&
      !EXEMPT.has(span) &&
      // A code span is only a path if it names a file, ends with a slash like the docs' directory
      // names, or starts with a directory that exists (so that e.g. `origin/master` isn't
      // mistaken for one).
      (FILE_NAME.test(span) ||
        span.endsWith('/') ||
        (span.includes('/') && candidates(doc, span.split('/')[0]).some(existsSync))),
  );
  return [...pathLike, ...links.filter(link => !/^[a-z]+:/.test(link))];
}

function candidates(doc: string, path: string) {
  return [dirname(doc), ...BASES].map(base => join(ROOT, base, path));
}

const dirs = findDirs();
const docs = [
  ...dirs.map(dir => join(dir, 'AGENTS.md')).filter(path => existsSync(join(ROOT, path))),
  ...findSkills(),
];

it('finds the root AGENTS.md', () => {
  expect(docs).toContain('AGENTS.md');
});

it("doesn't have a CLAUDE.md", () => {
  // Claude Code doesn't read an AGENTS.md that has one of these next to it, or any AGENTS.md when
  // there's one at the root.
  const claudeFiles = dirs
    .flatMap(dir => ['CLAUDE.md', '.claude/CLAUDE.md', 'CLAUDE.local.md'].map(n => join(dir, n)))
    .filter(path => existsSync(join(ROOT, path)));
  expect(claudeFiles, 'Put instructions in AGENTS.md instead').toEqual([]);
});

it.each(docs)('%s only names files that exist', doc => {
  const references = findReferences(doc);
  expect(references.length).toBeGreaterThan(0);
  const missing = references.filter(path => !candidates(doc, path).some(existsSync));
  expect(
    missing,
    `${doc} names paths that don't exist relative to it, the repo root, src/, or src/app/modules/editor/`,
  ).toEqual([]);
});
