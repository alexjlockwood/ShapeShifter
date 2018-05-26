#!/bin/bash -e

git checkout beta
npm i
ng build --prod
ngh --repo git@github.com:alexjlockwood/ShapeShifterBeta.git
