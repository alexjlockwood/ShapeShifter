#!/bin/bash -e

npm ci
npm run build
npx gh-pages --dist dist --nojekyll --cname shapeshifter.design \
  --repo git@github.com:alexjlockwood/ShapeShifterStable.git
