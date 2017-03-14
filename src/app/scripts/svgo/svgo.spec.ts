/* tslint:disable */

import 'jasmine';
import { svgToJs } from './lib/svg2js';
import { jsToSvg } from './lib/js2svg';
import { executePlugins } from './lib/plugins';
import { inlineStyles } from './plugins/inlineStyles';
import { convertStyleToAttrs } from './plugins/convertStyleToAttrs';
import { moveGroupAttrsToElems } from './plugins/moveGroupAttrsToElems';
import { convertPathData } from './plugins/convertPathData';
import { mergePaths } from './plugins/mergePaths';
import { removeDoctype } from './plugins/removeDoctype';
import { collapseGroups } from './plugins/collapseGroups';
import { convertShapeToPath } from './plugins/convertShapeToPath';
import { removeEmptyContainers } from './plugins/removeEmptyContainers';
import { removeHiddenElems } from './plugins/removeHiddenElems';
import { removeUselessDefs } from './plugins/removeUselessDefs';
import { removeEditorsNSData } from './plugins/removeEditorsNSData';
import { cleanupNumericValues } from './plugins/cleanupNumericValues';
import { convertTransforms } from './plugins/convertTransforms';
import { removeComments } from './plugins/removeComments';
import { removeMetadata } from './plugins/removeMetadata';
import { removeUnknownsAndDefaults } from './plugins/removeUnknownsAndDefaults';
import { removeEmptyText } from './plugins/removeEmptyText';
import { removeEmptyAttrs } from './plugins/removeEmptyAttrs';
import { removeNonInheritableGroupAttrs } from './plugins/removeNonInheritableGroupAttrs';
import { replaceUseElems } from './plugins/replaceUseElems';
import { removeUselessStrokeAndFill } from './plugins/removeUselessStrokeAndFill';

describe('SVGO plugins', function () {

  it('removeDoctype', () => {
    runTest(removeDoctype, `
<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">
<svg xmlns="http://www.w3.org/2000/svg">
    test
</svg>
`, `
<svg xmlns="http://www.w3.org/2000/svg">
    test
</svg>
`);
  });

  it('convertPathData', () => {
    runTest(convertPathData, `
<svg xmlns="http://www.w3.org/2000/svg">
    <path d="m100,200 300,400 z m100,200 L 300,400"/>
</svg>
`, `
<svg xmlns="http://www.w3.org/2000/svg">
    <path d="M100 200l300 400zm100 200h100"/>
</svg>
`);

    runTest(convertPathData, `
<svg xmlns="http://www.w3.org/2000/svg">
    <path d="M 10,50 L 20,30"/>
    <path d="M 10,50 C 20,30 40,50 60,70"/>
    <path d="M 10,50 C 20,30 40,50 60,70 S 20,30 30,60"/>
    <path d="M 10,50 Q 30,60 30,70"/>
    <path d="M 10,50 Q 30,60 30,70 T 40,70"/>
    <path d="M 10,50 A 20,60 45 0,1 40,70"/>
</svg>
`, `
<svg xmlns="http://www.w3.org/2000/svg">
    <path d="M10 50l10-20"/>
    <path d="M10 50c10-20 30 0 50 20"/>
    <path d="M10 50c10-20 30 0 50 20S20 30 30 60"/>
    <path d="M10 50q20 10 20 20"/>
    <path d="M10 50q20 10 20 20t10 0"/>
    <path d="M10 50a20 60 45 0 1 30 20"/>
</svg>
`);
    runTest(convertPathData, `
<svg xmlns="http://www.w3.org/2000/svg">
    <path d="M100 0v100l70-50zm70 50l70-50v100z"/>
    <path transform="" d="M0 0v100l70-50zm70 50l70-50v100z"/>
    <path fill="red" d="M118.742 187.108l79.162 124.74-96.593-25.883 8.716-49.428c17.43-98.857 89.875-79.446 81.16-30.017s63.728 68.84 72.444 19.411q13.073-74.143 87.877 75.31t193.185 51.764z"/>
    <path fill="red" stroke="red" transform="rotate(15) scale(.5) skewX(5) translate(200,100)" d="M100 200l200 200H100V300c0-200 150-200 150-100s150 100 150 0q0-150 200 100t400 0z"/>
    <path fill="red" stroke="red" transform="rotate(15) scale(.5) skewX(5) translate(200,100)" d="M100 200l200 200H100V300c0-200 150-200 150-100s150 100 150 0q0-150 200 100t400 0a150 150 0 1 0 150-150z"/>
    <path fill="red" stroke="red" d="M106.066 183.712l70.71 122.474-96.592-25.882 12.941-48.296c25.882-96.593 98.326-77.181 85.385-28.885s59.504 67.708 72.445 19.412q19.411-72.445 83.652 74.178t193.185 51.764z" stroke-width=".5"/>
    <path fill="red" stroke="red" d="M318.198 551.135L530.33 918.56l-289.778-77.646 38.823-144.889c77.646-289.778 294.98-231.543 256.156-86.655s178.51 203.124 217.334 58.235q58.234-217.334 250.955 222.534t579.555 155.292z" stroke-width="1.5"/>
    <path fill="red" stroke="red" d="M70.004 121.25l46.669 80.833L52.922 185l8.54-31.876c17.083-63.75 64.896-50.94 56.355-19.064s39.272 44.687 47.813 12.812q12.812-47.814 55.21 48.957t127.503 34.165z" stroke-width=".33"/>
    <g stroke="red">
        <path fill="red" d="M106.066 183.712l70.71 122.474-96.592-25.882 12.941-48.296c25.882-96.593 98.326-77.181 85.385-28.885s59.504 67.708 72.445 19.412q19.411-72.445 83.652 74.178t193.185 51.764z" stroke-width=".5"/>
    </g>
    <g stroke="red" stroke-width="2">
        <path fill="red" d="M106.066 183.712l70.71 122.474-96.592-25.882 12.941-48.296c25.882-96.593 98.326-77.181 85.385-28.885s59.504 67.708 72.445 19.412q19.411-72.445 83.652 74.178t193.185 51.764z" stroke-width="1"/>
    </g>
    <path transform="scale(10)" id="a" d="M0 0v100l70-50zm70 50l70-50v100z"/>
    <path transform="scale(10)" id="a" d="M0 0v100l70-50zm70 50l70-50v100z" stroke="#000"/>
    <path id="a" d="M0 0v1000l700-500zm700 500L1400 0v1000z" stroke="#000" stroke-width="5"/>
    <g stroke="#000" stroke-width="5">
        <path transform="scale(10)" id="a" d="M0 0v100l70-50zm70 50l70-50v100z"/>
    </g>
    <path fill="url(#gradient)" transform="rotate(15) scale(0.33) translate(200,100)" d="M100 200l200 200H100V300c0-200 150-200 150-100s150 100 150 0q0-150 200 100t400 0z"/>
    <path clip-path="url(#a)" transform="rotate(15) scale(0.33) translate(200,100)" d="M100 200l200 200H100V300c0-200 150-200 150-100s150 100 150 0q0-150 200 100t400 0z"/>
    <path d="M10 0a10 10 0 1 0 20 0"/>
    <path d="M3.864 1.035a8 12 15 1 0 15.455 4.141"/>
    <path d="M3.536 3.536a10 10 0 1 0 14.142 14.142"/>
    <path d="M5 0a16.18 6.18 31.717 1 0 20 0"/>
    <path d="M-12.122 332.074a80 240 15 1 0 154.548 41.41 80 240 15 1 0-154.548-41.41"/>
    <path d="M721.72 450.759a240 80 15 1 0 41.412-154.548 240 80 15 1 0-41.411 154.548"/>
    <path d="M8.6 6.4L5.4 9.5l3.2 3.1-.7.8L4 9.5l3.9-3.9zM5 10V9h10v1z"/>
    <path d="M561.214 392.766a48.107 95.08 10.132 1 1-94.083-20.365 48.107 95.079 10.132 1 1 94.082 20.365z"/>
    <path d="M-1.26-1.4a6.53 1.8-15.2 1 1 12.55-3.44"/>
</svg>`, `
<svg xmlns="http://www.w3.org/2000/svg">
    <path d="M100 0v100l70-50zm70 50l70-50v100z"/>
    <path transform="" d="M0 0v100l70-50zm70 50l70-50v100z"/>
    <path fill="red" d="M118.742 187.108l79.162 124.74-96.593-25.883 8.716-49.428c17.43-98.857 89.875-79.446 81.16-30.017s63.728 68.84 72.444 19.411q13.073-74.143 87.877 75.31t193.185 51.764z"/>
    <path fill="red" stroke="red" transform="rotate(15) scale(.5) skewX(5) translate(200,100)" d="M100 200l200 200H100V300c0-200 150-200 150-100s150 100 150 0q0-150 200 100t400 0z"/>
    <path fill="red" stroke="red" transform="rotate(15) scale(.5) skewX(5) translate(200,100)" d="M100 200l200 200H100V300c0-200 150-200 150-100s150 100 150 0q0-150 200 100t400 0a150 150 0 1 0 150-150z"/>
    <path fill="red" stroke="red" d="M106.066 183.712l70.71 122.474-96.592-25.882 12.941-48.296c25.882-96.593 98.326-77.181 85.385-28.885s59.504 67.708 72.445 19.412q19.411-72.445 83.652 74.178t193.185 51.764z" stroke-width=".5"/>
    <path fill="red" stroke="red" d="M318.198 551.135L530.33 918.56l-289.778-77.646 38.823-144.889c77.646-289.778 294.98-231.543 256.156-86.655s178.51 203.124 217.334 58.235q58.234-217.334 250.955 222.534t579.555 155.292z" stroke-width="1.5"/>
    <path fill="red" stroke="red" d="M70.004 121.25l46.669 80.833L52.922 185l8.54-31.876c17.083-63.75 64.896-50.94 56.355-19.064s39.272 44.687 47.813 12.812q12.812-47.814 55.21 48.957t127.503 34.165z" stroke-width=".33"/>
    <g stroke="red">
        <path fill="red" d="M106.066 183.712l70.71 122.474-96.592-25.882 12.941-48.296c25.882-96.593 98.326-77.181 85.385-28.885s59.504 67.708 72.445 19.412q19.411-72.445 83.652 74.178t193.185 51.764z" stroke-width=".5"/>
    </g>
    <g stroke="red" stroke-width="2">
        <path fill="red" d="M106.066 183.712l70.71 122.474-96.592-25.882 12.941-48.296c25.882-96.593 98.326-77.181 85.385-28.885s59.504 67.708 72.445 19.412q19.411-72.445 83.652 74.178t193.185 51.764z" stroke-width="1"/>
    </g>
    <path transform="scale(10)" id="a" d="M0 0v100l70-50zm70 50l70-50v100z"/>
    <path transform="scale(10)" id="a" d="M0 0v100l70-50zm70 50l70-50v100z" stroke="#000"/>
    <path id="a" d="M0 0v1000l700-500zm700 500L1400 0v1000z" stroke="#000" stroke-width="5"/>
    <g stroke="#000" stroke-width="5">
        <path transform="scale(10)" id="a" d="M0 0v100l70-50zm70 50l70-50v100z"/>
    </g>
    <path fill="url(#gradient)" transform="rotate(15) scale(0.33) translate(200,100)" d="M100 200l200 200H100V300c0-200 150-200 150-100s150 100 150 0q0-150 200 100t400 0z"/>
    <path clip-path="url(#a)" transform="rotate(15) scale(0.33) translate(200,100)" d="M100 200l200 200H100V300c0-200 150-200 150-100s150 100 150 0q0-150 200 100t400 0z"/>
    <path d="M10 0a10 10 0 1 0 20 0"/>
    <path d="M3.864 1.035a8 12 15 1 0 15.455 4.141"/>
    <path d="M3.536 3.536a10 10 0 1 0 14.142 14.142"/>
    <path d="M5 0a16.18 6.18 31.717 1 0 20 0"/>
    <path d="M-12.122 332.074a80 240 15 1 0 154.548 41.41 80 240 15 1 0-154.548-41.41"/>
    <path d="M721.72 450.759a240 80 15 1 0 41.412-154.548 240 80 15 1 0-41.411 154.548"/>
    <path d="M8.6 6.4L5.4 9.5l3.2 3.1-.7.8L4 9.5l3.9-3.9zM5 10V9h10v1z"/>
    <path d="M561.214 392.766a48.107 95.08 10.132 1 1-94.083-20.365 48.107 95.079 10.132 1 1 94.082 20.365z"/>
    <path d="M-1.26-1.4a6.53 1.8-15.2 1 1 12.55-3.44"/>
</svg>`
    );
  });

  it('convertTransforms', () => {
    convertTransforms.params.floatPrecision = 3;
    convertTransforms.params.transformPrecision = 5;
    runTest(convertTransforms, `
<svg xmlns="http://www.w3.org/2000/svg">
    <g transform="matrix(0.707 -0.707 0.707 0.707 255.03 111.21)"/>
    <g transform="matrix(1 0 0 1 50 90),matrix(0.707 -0.707 0.707 0.707 0 0) ,matrix(1 0 0 1 130 160)"/>
    <g transform="translate(50 90) , rotate(-45)   translate(130 160)"/>
    <g transform="matrix(0.707 -0.707 0.707 0.707 255.03 111.21) scale(2)"/>
    <g transform="matrix(0.707 -0.707 0.707 0.707 255.03 111.21) skewX(45)"/>
    <g transform="matrix( 0.707 -0.707 0.707 0.707 255.03 111.21 ) skewY( 45 )"/>
    <g transform="matrix(1 0 1 1 0 0)"/>
    <g transform="matrix(1.25,0,0,-1.25,0,56.26) scale(1,-1)"/>
    <g transform="matrix(1.25,0,0,-1.25,0,56.26) matrix(0.1325312,0,0,-0.1325312,-31.207631,89.011662)"/>
    <g transform="matrix(1 0 0 -1 0 0)"/>
    <g transform="matrix(-1 0 0 1 0 0)"/>
    <g transform="matrix(0 1-1 0 0 0)"/>
    <g transform="matrix(0-1 1 0 0 0)"/>
    <g transform="matrix(0.707 -0.707 -0.707 -0.707 0 0)"/>
    <g transform="matrix(-0.707 0.707 0.707 0.707 0 0)"/>
    <g transform="matrix(-0.707 0.707 -0.707 -0.707 0 0)"/>
    <g transform="matrix(0.707 0.707 -0.707 0.707 0 0)"/>
</svg>
`, `
<svg xmlns="http://www.w3.org/2000/svg">
    <g transform="rotate(-45 261.823 -252.215)"/>
    <g transform="rotate(-45 261.823 -252.215)"/>
    <g transform="rotate(-45 261.777 -252.28)"/>
    <g transform="scale(2) rotate(-45 130.898 -126.14)"/>
    <g transform="rotate(-45 261.823 -252.215) skewX(45)"/>
    <g transform="matrix(1.414 0 .707 .707 255.03 111.21)"/>
    <g transform="skewX(45)"/>
    <g transform="matrix(1.25 0 0 1.25 0 56.26)"/>
    <g transform="matrix(.16566 0 0 .16566 -39.01 -55.005)"/>
    <g transform="scale(1 -1)"/>
    <g transform="scale(-1 1)"/>
    <g transform="rotate(90)"/>
    <g transform="rotate(-90)"/>
    <g transform="scale(1 -1) rotate(45)"/>
    <g transform="scale(-1 1) rotate(45)"/>
    <g transform="rotate(135)"/>
    <g transform="rotate(45)"/>
</svg>
`);
  });

  it('inlineStyles', () => {
    const before = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 258.12 225.88">
  <style>
    .cls-7 {
      only-cls-7: 1;
    }
    .cls-7,
    .cls-8 {
      cls-7-and-8: 1;
    }
  </style>
  <path class="cls-7"/>
  <path d="M172.44 18.6c6.51-4.94 13 3.16 13 3.16l-14.57 10.09s-7.02-6.77 1.57-13.25z" class="cls-8"/>
</svg>`;
    const after = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 258.12 225.88">
    <path class="cls-7" style="only-cls-7:1;cls-7-and-8:1"/>
    <path d="M172.44 18.6c6.51-4.94 13 3.16 13 3.16l-14.57 10.09s-7.02-6.77 1.57-13.25z" class="cls-8" style="cls-7-and-8:1"/>
</svg>`;
    runTest(inlineStyles, before, after);
  });
});

function runTest(plugin, svgText: string, expectedSvgText: string) {
  optimize(svgText, plugin, optimized => {
    expect(optimized.trim()).toEqual(expectedSvgText.trim());
  });
}

const batchedSvgoPlugins = plugin => {
  let prevBatch;
  return Object.keys({ plugin })
    .map(p => [{ plugin }[p]])
    .filter(batch => {
      if (prevBatch && batch[0].type === prevBatch[0].type) {
        prevBatch.push(batch[0]);
        return false;
      }
      prevBatch = batch;
      return true;
    });
};

function optimize(svgText: string, plugin, callback: (optimizedSvgText: string) => void) {
  svgToJs(svgText, svgJs => {
    if (svgJs.error) {
      console.warn('Failed to parse the specified SVG string.');
      callback(svgText);
      return;
    }
    callback(jsToSvg(executePlugins(svgJs, batchedSvgoPlugins(plugin)), {
      indent: '    ',
      pretty: true,
    }).data);
  });
}
