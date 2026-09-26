#!/usr/bin/env node

// Copies src/ from a git ref into .playground-baseline/, so that the auto fix playground
// (src/playground/autofix/) can compare that version of the algorithm with the working tree.
//
//   node scripts/playground-baseline.mjs [ref]            Copies the ref (see defaultRef below).
//   node scripts/playground-baseline.mjs --if-missing     Only copies if there's no copy yet.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const BASELINE_DIR = fileURLToPath(new URL('../.playground-baseline/', import.meta.url));

const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();

/** Returns the commit where this branch left origin/master, so the baseline is "before". */
function defaultRef() {
  try {
    return {
      ref: git('merge-base', 'HEAD', 'origin/master'),
      label: 'merge-base with origin/master',
    };
  } catch {
    return { ref: 'master', label: 'master' };
  }
}

const args = process.argv.slice(2);
const ifMissing = args.includes('--if-missing');
const refArg = args.find(arg => !arg.startsWith('--'));

if (ifMissing && existsSync(BASELINE_DIR)) {
  process.exit(0);
}

const { ref, label } = refArg ? { ref: refArg, label: refArg } : defaultRef();
const sha = git('rev-parse', '--verify', `${ref}^{commit}`);

rmSync(BASELINE_DIR, { recursive: true, force: true });
mkdirSync(BASELINE_DIR, { recursive: true });
const archive = execFileSync('git', ['archive', '--format=tar', sha, 'src'], {
  cwd: ROOT,
  maxBuffer: 1024 * 1024 * 1024,
});
execFileSync('tar', ['-x', '-C', BASELINE_DIR], { input: archive });

const info = {
  label,
  sha,
  subject: git('log', '-1', '--format=%s', sha),
  date: git('log', '-1', '--format=%cs', sha),
};
writeFileSync(`${BASELINE_DIR}baseline.json`, `${JSON.stringify(info, null, 2)}\n`);
console.log(`Copied src/ from ${label} (${sha.slice(0, 7)}, "${info.subject}")`);
console.log('into .playground-baseline/ for the auto fix playground.');
