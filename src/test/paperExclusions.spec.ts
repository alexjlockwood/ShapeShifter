// @vitest-environment node

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// The unported paper.js beta editor is left out of tsc, oxlint, and Prettier, and AGENTS.md tells
// agents to leave it alone. Checks that all four name the same paths.

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const EDITOR = 'src/app/modules/editor/';

const read = (file: string) => readFileSync(join(ROOT, file), 'utf8');
const normalize = (paths: string[]) => paths.map(path => path.replace(/\/(\*\*)?$/, '')).sort();

const tsc = normalize(JSON.parse(read('tsconfig.json')).exclude);

it('leaves the same paths out of oxlint', () => {
  // The file has comments, so it isn't valid JSON as a whole.
  const [array] = read('.oxlintrc.json').match(/"ignorePatterns":\s*\[[^\]]*\]/) ?? [''];
  const ignored: string[] = JSON.parse(`{${array}}`).ignorePatterns;
  expect(normalize(ignored.filter(pattern => pattern !== 'dist/**'))).toEqual(tsc);
});

it('leaves the same paths out of Prettier', () => {
  const ignored = read('.prettierignore')
    .split('\n')
    .filter(line => line.startsWith('src/'));
  expect(normalize(ignored)).toEqual(tsc);
});

it('names the same paths in AGENTS.md', () => {
  // The sentence that lists the paths, which ends where the section goes on to the instructions.
  const list = read('AGENTS.md').split('## Code to leave alone')[1].split("Don't edit it")[0];
  const named = Array.from(list.matchAll(/`([^`]+)`/g), match =>
    match[1].startsWith('src/') ? match[1] : EDITOR + match[1],
  );
  expect(normalize(named)).toEqual(tsc);
});
