#!/bin/bash -e

# The site is built from whatever is checked out, so refuse to publish anything but a clean copy of
# origin/master: a local branch, unpushed commits, or uncommitted and untracked files would all put
# changes on the live site that aren't on GitHub.
git fetch origin master
if [ "$(git rev-parse HEAD)" != "$(git rev-parse origin/master)" ]; then
  echo "Not deploying: HEAD isn't origin/master. Check out origin/master first." >&2
  exit 1
fi
if ! git diff --quiet || ! git diff --cached --quiet || [ -n "$(git status --porcelain)" ]; then
  echo "Not deploying: the working tree has changes or untracked files. Commit, stash, or" \
    "remove them first (git status lists them)." >&2
  exit 1
fi

npm ci
npm run build
npx gh-pages --dist dist --nojekyll --cname shapeshifter.design \
  --repo git@github.com:alexjlockwood/ShapeShifterStable.git
