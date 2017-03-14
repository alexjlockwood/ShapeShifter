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

convertTransforms.params.floatPrecision = 3;
convertTransforms.params.transformPrecision = 5;

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
</svg>
`, `
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
</svg>`);
  });

  it('inlineStyles', () => {
    runTest(inlineStyles, `
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
</svg>
`, `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 258.12 225.88">
    <path class="cls-7" style="only-cls-7:1;cls-7-and-8:1"/>
    <path d="M172.44 18.6c6.51-4.94 13 3.16 13 3.16l-14.57 10.09s-7.02-6.77 1.57-13.25z" class="cls-8" style="cls-7-and-8:1"/>
</svg>`);
  });

  describe('mergePaths', function () {
    it('#1', () => {
      runTest(mergePaths, `
<svg xmlns="http://www.w3.org/2000/svg">
    <path d="M 0,0 z"/>
    <path d="M 10,10 z"/>
    <path d="M 20,20 l 10,10 M 30,0 c 10,0 20,10 20,20"/>
    <path d="M 30,30 z"/>
    <path d="M 30,30 z" fill="#f00"/>
    <path d="M 40,40 z"/>
    <path d="m 50,50 0,10 20,30 40,0"/>
</svg>
`, `
<svg xmlns="http://www.w3.org/2000/svg">
    <path d="M0 0zM10 10zM20 20l10 10M30 0c10 0 20 10 20 20M30 30z"/>
    <path d="M 30,30 z" fill="#f00"/>
    <path d="M40 40zM50 50l0 10 20 30 40 0"/>
</svg>`);
    });

    it('#2', () => {
      runTest(mergePaths, `
<svg xmlns="http://www.w3.org/2000/svg">
    <path d="M 0,0 z" fill="#fff" stroke="#333"/>
    <path d="M 10,10 z" fill="#fff" stroke="#333"/>
    <path d="M 20,20" fill="#fff" stroke="#333"/>
    <path d="M 30,30 z" fill="#fff" stroke="#333"/>
    <path d="M 30,30 z" fill="#f00"/>
    <path d="M 40,40 z"/>
    <path d="m 50,50 z"/>
    <path d="M 40,40"/>
    <path d="m 50,50"/>
    <path d="M 40,40 z" fill="#fff" stroke="#333"/>
    <path d="m 50,50 z" fill="#fff" stroke="#333"/>
    <path d="M 40,40" fill="#fff" stroke="#333"/>
    <path d="m 50,50" fill="#fff" stroke="#333"/>
    <path d="m 50,50 z" fill="#fff" stroke="#333"/>
    <path d="M0 0v100h100V0z" fill="red"/>
    <path d="M200 0v100h100V0z" fill="red"/>
    <path d="M0 0v100h100V0z" fill="blue"/>
    <path d="M200 0v100h100V0zM0 200h100v100H0z" fill="blue"/>
</svg>
`, `
<svg xmlns="http://www.w3.org/2000/svg">
    <path d="M0 0zM10 10zM30 30z" fill="#fff" stroke="#333"/>
    <path d="M 30,30 z" fill="#f00"/>
    <path d="M40 40zM50 50zM50 50"/>
    <path d="M40 40zM50 50zM50 50z" fill="#fff" stroke="#333"/>
    <path d="M0 0v100h100V0zM200 0v100h100V0z" fill="red"/>
    <path d="M0 0v100h100V0zM200 0v100h100V0zM0 200h100v100H0z" fill="blue"/>
</svg>`);
    });

    it('#3', () => {
      runTest(mergePaths, `
<svg xmlns="http://www.w3.org/2000/svg">
    <path d="M30 0L0 40H60z"/>
    <path d="M0 10H60L30 50z"/>
    <path d="M0 0V50L50 0"/>
    <path d="M0 60L50 10V60"/>
    <g>
        <path d="M100 0a50 50 0 0 1 0 100"/>
        <path d="M25 25H75V75H25z"/>
        <path d="M135 85H185V135H135z"/>
    </g>
    <g>
        <path d="M10 14H7v1h3v-1z"/>
        <path d="M9 21H8v1h1v-1z"/>
    </g>
    <g>
        <path d="M30 32.705V40h10.42L30 32.705z"/>
        <path d="M46.25 34.928V30h-7.04l7.04 4.928z"/>
    </g>
    <g>
        <path d="M20 20H60L100 30"/>
        <path d="M20 20L50 30H100"/>
    </g>
</svg>
`, `
<svg xmlns="http://www.w3.org/2000/svg">
    <path d="M30 0L0 40H60z"/>
    <path d="M0 10H60L30 50z"/>
    <path d="M0 0V50L50 0M0 60L50 10V60"/>
    <g>
        <path d="M100 0a50 50 0 0 1 0 100M25 25H75V75H25z"/>
        <path d="M135 85H185V135H135z"/>
    </g>
    <g>
        <path d="M10 14H7v1h3v-1zM9 21H8v1h1v-1z"/>
    </g>
    <g>
        <path d="M30 32.705V40h10.42L30 32.705zM46.25 34.928V30h-7.04l7.04 4.928z"/>
    </g>
    <g>
        <path d="M20 20H60L100 30M20 20L50 30H100"/>
    </g>
</svg>`);
    });

    it('#4', () => {
      runTest(mergePaths, `
<svg xmlns="http://www.w3.org/2000/svg">
    <path d="M320 60c17.466-8.733 33.76-12.78 46.593-12.484 12.856.297 22.254 4.936 26.612 12.484 4.358 7.548 3.676 18.007-2.494 29.29-6.16 11.26-17.812 23.348-34.107 34.107-16.26 10.735-37.164 20.14-60.72 26.613C272.356 156.473 246.178 160 220 160c-26.18 0-52.357-3.527-75.882-9.99-23.557-6.472-44.462-15.878-60.72-26.613-16.296-10.76-27.95-22.846-34.11-34.108-6.17-11.283-6.85-21.742-2.493-29.29 4.358-7.548 13.756-12.187 26.612-12.484C86.24 47.22 102.535 51.266 120 60c17.426 8.713 36.024 22.114 53.407 39.28C190.767 116.42 206.91 137.33 220 160c13.09 22.67 23.124 47.106 29.29 70.71 6.173 23.638 8.48 46.445 7.313 65.893-1.17 19.49-5.812 35.627-12.485 46.592C237.432 354.18 228.716 360 220 360s-17.432-5.82-24.118-16.805c-6.673-10.965-11.315-27.1-12.485-46.592-1.167-19.448 1.14-42.255 7.314-65.892 6.166-23.604 16.2-48.04 29.29-70.71 13.09-22.67 29.233-43.58 46.593-60.72C283.976 82.113 302.573 68.712 320 60z"/>
    <path d="M280 320l100-173.2h200l100 173.2-100 173.2h-200"/>
    <g>
        <path d="M706.69 299.29c-.764-11.43-6.036-56.734-16.338-71.32 0 0 9.997 14.14 11.095 76.806l5.243-5.486z"/>
        <path d="M705.16 292.54c-5.615-35.752-25.082-67.015-25.082-67.015 7.35 15.128 20.257 53.835 23.64 77.45l2.33-2.24-.888-8.195z"/>
    </g>
</svg>
`, `
<svg xmlns="http://www.w3.org/2000/svg">
    <path d="M320 60c17.466-8.733 33.76-12.78 46.593-12.484 12.856.297 22.254 4.936 26.612 12.484 4.358 7.548 3.676 18.007-2.494 29.29-6.16 11.26-17.812 23.348-34.107 34.107-16.26 10.735-37.164 20.14-60.72 26.613C272.356 156.473 246.178 160 220 160c-26.18 0-52.357-3.527-75.882-9.99-23.557-6.472-44.462-15.878-60.72-26.613-16.296-10.76-27.95-22.846-34.11-34.108-6.17-11.283-6.85-21.742-2.493-29.29 4.358-7.548 13.756-12.187 26.612-12.484C86.24 47.22 102.535 51.266 120 60c17.426 8.713 36.024 22.114 53.407 39.28C190.767 116.42 206.91 137.33 220 160c13.09 22.67 23.124 47.106 29.29 70.71 6.173 23.638 8.48 46.445 7.313 65.893-1.17 19.49-5.812 35.627-12.485 46.592C237.432 354.18 228.716 360 220 360s-17.432-5.82-24.118-16.805c-6.673-10.965-11.315-27.1-12.485-46.592-1.167-19.448 1.14-42.255 7.314-65.892 6.166-23.604 16.2-48.04 29.29-70.71 13.09-22.67 29.233-43.58 46.593-60.72C283.976 82.113 302.573 68.712 320 60zM280 320l100-173.2h200l100 173.2-100 173.2h-200"/>
    <g>
        <path d="M706.69 299.29c-.764-11.43-6.036-56.734-16.338-71.32 0 0 9.997 14.14 11.095 76.806l5.243-5.486z"/>
        <path d="M705.16 292.54c-5.615-35.752-25.082-67.015-25.082-67.015 7.35 15.128 20.257 53.835 23.64 77.45l2.33-2.24-.888-8.195z"/>
    </g>
</svg>`);
    });
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
