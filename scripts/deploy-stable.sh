#!/bin/bash -e

npm i
ng build --prod --sourcemaps --app stable
echo "shapeshifter.design" > dist/CNAME
ngh
