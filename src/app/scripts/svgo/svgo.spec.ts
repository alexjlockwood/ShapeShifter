/* tslint:disable */

import { js2svg } from './lib/js2svg';
import { executePlugins } from './lib/plugins';
import { svg2js } from './lib/svg2js';
import { cleanupNumericValues } from './plugins/cleanupNumericValues';
import { collapseGroups } from './plugins/collapseGroups';
import { convertPathData } from './plugins/convertPathData';
import { convertShapeToPath } from './plugins/convertShapeToPath';
import { convertStyleToAttrs } from './plugins/convertStyleToAttrs';
import { convertTransforms } from './plugins/convertTransforms';
import { inlineStyles } from './plugins/inlineStyles';
import { mergePaths } from './plugins/mergePaths';
import { moveGroupAttrsToElems } from './plugins/moveGroupAttrsToElems';
import { removeComments } from './plugins/removeComments';
import { removeDoctype } from './plugins/removeDoctype';
import { removeEditorsNSData } from './plugins/removeEditorsNSData';
import { removeEmptyAttrs } from './plugins/removeEmptyAttrs';
import { removeEmptyContainers } from './plugins/removeEmptyContainers';
import { removeEmptyText } from './plugins/removeEmptyText';
import { removeHiddenElems } from './plugins/removeHiddenElems';
import { removeMetadata } from './plugins/removeMetadata';
import { removeNonInheritableGroupAttrs } from './plugins/removeNonInheritableGroupAttrs';
import { removeUnknownsAndDefaults } from './plugins/removeUnknownsAndDefaults';
import { removeUselessDefs } from './plugins/removeUselessDefs';
import { removeUselessStrokeAndFill } from './plugins/removeUselessStrokeAndFill';
import { replaceUseElems } from './plugins/replaceUseElems';

describe('SVGO plugins', () => {

  beforeEach(() => {
    convertPathData.params.floatPrecision = 3;
    convertPathData.params.transformPrecision = 5;
    convertPathData.params.makeArcs = { threshold: 2.5, tolerance: 0.5 };
    convertTransforms.params.floatPrecision = 3;
    convertTransforms.params.transformPrecision = 5;
  });

  describe('removeDoctype', () => {
    it('#1', () => {
      runTest(removeDoctype, `
<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">
<svg xmlns="http://www.w3.org/2000/svg">
    test
</svg>
`, `
<svg xmlns="http://www.w3.org/2000/svg">
    test
</svg>`);
    });
  });

  describe('convertPathData', () => {
    it('#1', () => {
      runTest(convertPathData, `
<svg xmlns="http://www.w3.org/2000/svg">
    <path d="M 10,50"/>
    <path d="M 10 50"/>
    <path d="M10 50"/>
    <path d="M10,50"/>
    <path d="M10-3.05176e-005"/>
    <path d="M10-50.2.30-2"/>
    <path d="M10-50l.2.30"/>
    <path d="M 10 , 50"/>
    <path d="M -10,-50"/>
    <path d="M -10 -50"/>
    <path d="M-10 -50"/>
    <path d="M-10-50"/>
    <path d="M-10,-50"/>
    <path d="M -10 , -50"/>
    <path d="..."/>
</svg>
`, `
<svg xmlns="http://www.w3.org/2000/svg">
    <path d="M10 50"/>
    <path d="M10 50"/>
    <path d="M10 50"/>
    <path d="M10 50"/>
    <path d="M10 0"/>
    <path d="M10-50.2L.3-2"/>
    <path d="M10-50l.2.3"/>
    <path d="M10 50"/>
    <path d="M-10-50"/>
    <path d="M-10-50"/>
    <path d="M-10-50"/>
    <path d="M-10-50"/>
    <path d="M-10-50"/>
    <path d="M-10-50"/>
    <path d="..."/>
</svg>`);
    });

    it('#2', () => {
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
</svg>`);
    });

    it('#3', () => {
      runTest(convertPathData, `
<svg xmlns="http://www.w3.org/2000/svg">
    <path d="M 10,50 M 20,60"/>
    <path d="M 10,50 20,60"/>
    <path d="M 10,50 L 20,30 L 40,60"/>
    <path d="M 10,50 L 20,30 40,60"/>
    <path d="M 10,50 C 20,30 40,50 60,70 C 40,40 50,60 70,80"/>
    <path d="M 10,50 C 20,30 40,50 60,70 40,40 50,60 70,80"/>
    <path d="M 10,50 C 20,30 40,50 60,70 S 30,30 40,50 S 60,70 80,100"/>
    <path d="M 10,50 C 20,30 40,50 60,70 S 30,30 40,50 60,70 80,100"/>
    <path d="M 10,50 Q 30,60 30,70 Q 40,70 50,90"/>
    <path d="M 10,50 Q 30,60 30,70 40,70 50,90"/>
    <path d="M 10,50 Q 30,60 30,70 T 40,70 T 50,90"/>
    <path d="M 10,50 Q 30,60 30,70 T 40,70 50,90"/>
    <path d="M 10,50 A 20,60 45 0,1 40,70 A 30,50 -30 1,1 50,70"/>
    <path d="M 10,50 A 20,60 45 0,1 40,70 30,50 -30 1,1 50,70"/>
    <path d="M0,0 0,5 0,10" marker-mid="url(#)"/>
</svg>
`, `
<svg xmlns="http://www.w3.org/2000/svg">
    <path d="M20 60"/>
    <path d="M10 50l10 10"/>
    <path d="M10 50l10-20 20 30"/>
    <path d="M10 50l10-20 20 30"/>
    <path d="M10 50c10-20 30 0 50 20-20-30-10-10 10 10"/>
    <path d="M10 50c10-20 30 0 50 20-20-30-10-10 10 10"/>
    <path d="M10 50c10-20 30 0 50 20S30 30 40 50s20 20 40 50"/>
    <path d="M10 50c10-20 30 0 50 20S30 30 40 50s20 20 40 50"/>
    <path d="M10 50q20 10 20 20 10 0 20 20"/>
    <path d="M10 50q20 10 20 20 10 0 20 20"/>
    <path d="M10 50q20 10 20 20t10 0 10 20"/>
    <path d="M10 50q20 10 20 20t10 0 10 20"/>
    <path d="M10 50a20 60 45 0 1 30 20 30 50-30 1 1 10 0"/>
    <path d="M10 50a20 60 45 0 1 30 20 30 50-30 1 1 10 0"/>
    <path d="M0 0v5 5" marker-mid="url(#)"/>
</svg>`);
    });

    it('#4', () => {
      runTest(convertPathData, `
<svg xmlns="http://www.w3.org/2000/svg">
    <path d="M 10,50 l 20,30 L 20,30"/>
    <path d="M 10,50 c 20,30 40,50 60,70 C 20,30 40,50 60,70"/>
    <path d="M 10,50 c 20,30 40,50 60,70 s 20,40 40,50 L 10,20"/>
    <path d="M 10,50 q 20,60 30,70 Q 20,60 30,70"/>
    <path d="M 10,50 q 20,60 30,70 t 40,70 L 10,20"/>
    <path d="M 10,50 a 20,60 45 0,1 40,70 A 20,60 45 0,1 40,70"/>
</svg>
`, `
<svg xmlns="http://www.w3.org/2000/svg">
    <path d="M10 50l20 30-10-50"/>
    <path d="M10 50c20 30 40 50 60 70-50-90-30-70-10-50"/>
    <path d="M10 50c20 30 40 50 60 70s20 40 40 50L10 20"/>
    <path d="M10 50q20 60 30 70-20-60-10-50"/>
    <path d="M10 50q20 60 30 70t40 70L10 20"/>
    <path d="M10 50a20 60 45 0 1 40 70 20 60 45 0 1-10-50"/>
</svg>`);
    });

    it('#5', () => {
      runTest(convertPathData, `
<svg xmlns="http://www.w3.org/2000/svg">
    <path d="M 10.3467,50.09 L 10.0000,50.20"/>
    <path d="m 10 10 l 1 1 M 20 20"/>
    <path d="m 0 0 l .1133 1 l .1133 2 l .1133 3"/>
    <path d="m 0 0 l .0025 3 .0025 2 .0025 3 .0025 2"/>
</svg>
`, `
<svg xmlns="http://www.w3.org/2000/svg">
    <path d="M10.347 50.09L10 50.2"/>
    <path d="M10 10l1 1m9 9"/>
    <path d="M0 0l.113 1 .114 2L.34 6"/>
    <path d="M0 0l.003 3 .002 2 .003 3 .002 2"/>
</svg>`);
    });

    it('#6', () => {
      runTest(convertPathData, `
<svg xmlns="http://www.w3.org/2000/svg">
    <path d="M 10,50 L 10,50"/>
    <path d="M 10,50 L 20,50"/>
    <path d="M 10,50 L 10,60"/>
    <path d="M 10,50 L 20,30 10,30"/>
    <path d="M 10,50 L 20,30 20,20"/>
    <path d="M 10,50 L 20,30 10,30 40,50"/>
    <path d="M 10,50 L 20,30 20,20 40,50"/>
    <path d="M 10,50 L 20,50 L 30,50"/>
    <path d="M 10,50 L 20,50 30,50"/>
    <path d="M 10,50 L 20,50 L 30,50 L 40,50"/>
    <path d="M 10,50 L 10,60 L 10,70"/>
    <path d="M 10,50 L 10,60 10,70"/>
    <path d="M 10,50 L 10,60 L 10,70 L 10,80"/>
</svg>
`, `
<svg xmlns="http://www.w3.org/2000/svg">
    <path d="M10 50"/>
    <path d="M10 50h10"/>
    <path d="M10 50v10"/>
    <path d="M10 50l10-20H10"/>
    <path d="M10 50l10-20V20"/>
    <path d="M10 50l10-20H10l30 20"/>
    <path d="M10 50l10-20V20l20 30"/>
    <path d="M10 50h20"/>
    <path d="M10 50h20"/>
    <path d="M10 50h30"/>
    <path d="M10 50v20"/>
    <path d="M10 50v20"/>
    <path d="M10 50v30"/>
</svg>`);
    });

    it('#7', () => {
      runTest(convertPathData, `
<svg xmlns="http://www.w3.org/2000/svg">
    <path d="m 0,0"/>
    <path d="m 0,0l 0,0"/>
    <path d="m 0,0h 0"/>
    <path d="m 0,0v 0"/>
    <path d="m 0,0c 0,0 0,0 0,0 s 0,0 0,0"/>
    <path d="m 0,0q 0,0 0,0 t 0,0"/>
    <path d="m 0,0a 25,25 -30 0,1 0,0"/>
</svg>
`, `
<svg xmlns="http://www.w3.org/2000/svg">
    <path d="M0 0"/>
    <path d="M0 0"/>
    <path d="M0 0"/>
    <path d="M0 0"/>
    <path d="M0 0"/>
    <path d="M0 0"/>
    <path d="M0 0"/>
</svg>`);
    });

    it('#8', () => {
      runTest(convertPathData, `
<svg xmlns="http://www.w3.org/2000/svg">
    <path d="M100,200 C200,200 300,200 400,200"/>
    <path d="M100,200 C100,200 250,200 250,200 S300,200 400,200"/>
    <path d="M100,200 C100,200 250,200 250,200 S300,300 400,210"/>
    <path d="M100,200 S250,250 250,250 S400,250 500,250"/>
    <path d="M100,200 Q200,200 300,200"/>
    <path d="M100,200 Q400,200 600,200 T800,200"/>
    <path d="M100,200 Q400,200 600,200 T800,300"/>
    <path d="M100,200 Q200,200 200,300 T200,500 T300,500"/>
    <path d="M100,200 Q400,200 600,200 T800,200 T900,300"/>
    <path d="M100,200 T800,300"/>
    <path d="M100,200 A0,150 0 0,0 150,150"/>
    <path d="M100,200 A150,0 0 0,0 150,150"/>
    <path d="M100,200 c-2.5 10.5-4 21-4 32 0 64 63.5 128 127.5 128s32.5 0 96.5 0 128-64 128-128-64-128-128-128"/>
</svg>
`, `
<svg xmlns="http://www.w3.org/2000/svg">
    <path d="M100 200h300"/>
    <path d="M100 200h300"/>
    <path d="M100 200h150s50 100 150 10"/>
    <path d="M100 200l150 50h250"/>
    <path d="M100 200h200"/>
    <path d="M100 200h700"/>
    <path d="M100 200h500q200 0 200 100"/>
    <path d="M100 200q100 0 100 100t0 200 100 0"/>
    <path d="M100 200h700l100 100"/>
    <path d="M100 200l700 100"/>
    <path d="M100 200l50-50"/>
    <path d="M100 200l50-50"/>
    <path d="M100 200c-2.5 10.5-4 21-4 32 0 64 63.5 128 127.5 128H320c64 0 128-64 128-128s-64-128-128-128"/>
</svg>`);
    });

    it('#9', () => {
      runTest(convertPathData, `
<svg xmlns="http://www.w3.org/2000/svg">
    <path d="M100,200 C100,100 450,100 250,200 C50,300 400,300 400,200"/>
    <path d="M100,200 S250,100 250,200 C250,300 300,250 400,200"/>
    <path d="M100,200 C100,200 250,100 250,200"/>
    <path d="M200,300 Q400,50 600,300 Q 800,550 1000,300"/>
    <path d="M200,300 Q400,50 600,300 T1000,300 Q1200,50 1400,300"/>
</svg>
`, `
<svg xmlns="http://www.w3.org/2000/svg">
    <path d="M100 200c0-100 350-100 150 0s150 100 150 0"/>
    <path d="M100 200s150-100 150 0 50 50 150 0"/>
    <path d="M100 200s150-100 150 0"/>
    <path d="M200 300q200-250 400 0t400 0"/>
    <path d="M200 300q200-250 400 0t400 0 400 0"/>
</svg>`);
    });

    it('#10', () => {
      runTest(convertPathData, `
<svg xmlns="http://www.w3.org/2000/svg">
    <path d="m100,200 300,400 z m100,200 L 300,400"/>
</svg>
`, `
<svg xmlns="http://www.w3.org/2000/svg">
    <path d="M100 200l300 400zm100 200h100"/>
</svg>
`);
    });

    it('#11', () => {
      runTest(convertPathData, `
<svg xmlns="http://www.w3.org/2000/svg">
    <path transform="translate(100,0)" d="M0,0 V100 L 70,50 z M70,50 L140,0 V100 z"/>
    <path transform="" d="M0,0 V100 L 70,50 z M70,50 L140,0 V100 z"/>
    <path fill="red" transform="rotate(15) scale(.5) skewX(5) translate(200,100)" d="M100,200 300,400 H100 V300 C100,100 250,100 250,200 S400,300 400,200 Q400,50 600,300 T1000,300 z"/>
    <path fill="red" stroke="red" transform="rotate(15) scale(.5) skewX(5) translate(200,100)" d="M100,200 300,400 H100 V300 C100,100 250,100 250,200 S400,300 400,200 Q400,50 600,300 T1000,300 z"/>
    <path fill="red" stroke="red" transform="rotate(15) scale(.5) skewX(5) translate(200,100)" d="M100,200 300,400 H100 V300 C100,100 250,100 250,200 S400,300 400,200 Q400,50 600,300 T1000,300 a150,150 0 1,0 150,-150 z"/>
    <path fill="red" stroke="red" transform="rotate(15) scale(.5) translate(200,100)" d="M100,200 300,400 H100 V300 C100,100 250,100 250,200 S400,300 400,200 Q400,50 600,300 T1000,300 z"/>
    <path fill="red" stroke="red" transform="rotate(15) scale(1.5) translate(200,100)" d="M100,200 300,400 H100 V300 C100,100 250,100 250,200 S400,300 400,200 Q400,50 600,300 T1000,300 z"/>
    <path fill="red" stroke="red" transform="rotate(15) scale(0.33) translate(200,100)" d="M100,200 300,400 H100 V300 C100,100 250,100 250,200 S400,300 400,200 Q400,50 600,300 T1000,300 z"/>
    <g stroke="red">
        <path fill="red" transform="rotate(15) scale(.5) translate(200,100)" d="M100,200 300,400 H100 V300 C100,100 250,100 250,200 S400,300 400,200 Q400,50 600,300 T1000,300 z"/>
    </g>
    <g stroke="red" stroke-width="2">
        <path fill="red" transform="rotate(15) scale(.5) translate(200,100)" d="M100,200 300,400 H100 V300 C100,100 250,100 250,200 S400,300 400,200 Q400,50 600,300 T1000,300 z"/>
    </g>
    <path transform="scale(10)" id="a" d="M0,0 V100 L 70,50 z M70,50 L140,0 V100 z"/>
    <path transform="scale(10)" id="a" d="M0,0 V100 L 70,50 z M70,50 L140,0 V100 z" stroke="#000"/>
    <path transform="scale(10)" id="a" d="M0,0 V100 L 70,50 z M70,50 L140,0 V100 z" stroke="#000" stroke-width=".5"/>
    <g stroke="#000" stroke-width="5">
        <path transform="scale(10)" id="a" d="M0,0 V100 L 70,50 z M70,50 L140,0 V100 z"/>
    </g>
    <path fill="url(#gradient)" transform="rotate(15) scale(0.33) translate(200,100)" d="M100,200 300,400 H100 V300 C100,100 250,100 250,200 S400,300 400,200 Q400,50 600,300 T1000,300 z"/>
    <path clip-path="url(#a)" transform="rotate(15) scale(0.33) translate(200,100)" d="M100,200 300,400 H100 V300 C100,100 250,100 250,200 S400,300 400,200 Q400,50 600,300 T1000,300 z"/>
    <path d="M5 0a10 10 0 1 0 20 0" transform="matrix(1 0 0 1 5 0)"/>
    <path d="M5 0a10 10 0 1 0 20 0" transform="rotate(15) scale(.8,1.2) "/>
    <path d="M5 0a10 10 0 1 0 20 0" transform="rotate(45)"/>
    <path d="M5 0a10 10 0 1 0 20 0" transform="skewX(45)"/>
    <path d="M0 300a1 2 0 1 0 200 0a1 2 0 1 0 -200 0" transform="rotate(15 100 300) scale(.8 1.2)"/>
    <path d="M700 300a1 2 0 1 0 200 0a1 2 0 1 0 -200 0" transform="rotate(-75 700 300) scale(.8 1.2)"/>
    <path d="M12.6 8.6l-3.1-3.2-3.1 3.2-.8-.7 3.9-3.9 3.9 3.9zM9 5h1v10h-1z" transform="rotate(-90 9.5 9.5)"/>
    <path d="M637.43 482.753a43.516 94.083 0 1 1-87.033 0 43.516 94.083 0 1 1 87.032 0z" transform="matrix(1.081 .234 -.187 .993 -37.573 -235.766)"/>
    <path d="m-1.26-1.4a6.53 1.8-15.2 1 1 12.55-3.44" transform="translate(0, 0)"/>
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
</svg>
`);
    });

    it('#12', () => {
      runTest(convertPathData, `
<svg xmlns="http://www.w3.org/2000/svg">
    <path d="M10 50h30h-30"/>
    <path d="M10 50h-30h30"/>
    <path d="M10 50h-30h-50"/>
    <path d="M10 50h30h50"/>
    <path d="M10 50v30v-30"/>
    <path d="M10 50v-30v30"/>
    <path d="M10 50v-30v-50"/>
    <path d="M10 50v30v50"/>
    <path d="M10 50L10 80L10 0"/>
    <path d="M10 50L10 10L10 80"/>
    <path d="M10 50l10 10l20 20l10 10"/>
    <path d="M10 50L80 50L0 50"/>
    <path d="M10 50L0 50L80 50"/>
    <path d="M10 50L0 50M80 50M30 10L10 80"/>
</svg>
`, `
<svg xmlns="http://www.w3.org/2000/svg">
    <path d="M10 50h30-30"/>
    <path d="M10 50h-30 30"/>
    <path d="M10 50h-80"/>
    <path d="M10 50h80"/>
    <path d="M10 50v30-30"/>
    <path d="M10 50V20v30"/>
    <path d="M10 50v-80"/>
    <path d="M10 50v80"/>
    <path d="M10 50v30V0"/>
    <path d="M10 50V10v70"/>
    <path d="M10 50l10 10 20 20 10 10"/>
    <path d="M10 50h70H0"/>
    <path d="M10 50H0h80"/>
    <path d="M10 50H0m30-40L10 80"/>
</svg>`);
    });

    it('#13', () => {
      runTest(convertPathData, `
<svg xmlns="http://www.w3.org/2000/svg">
    <path d="M213 543q0 -41 20 -66.5q20 -25.5 50 -45.5l49 228q-54 -4 -86.5 -34q-32.5 -30 -32.5 -82zt0 0zM371 48z" />
</svg>
`, `
<svg xmlns="http://www.w3.org/2000/svg">
    <path d="M213 543q0-41 20-66.5t50-45.5l49 228q-54-4-86.5-34T213 543zM371 48z"/>
</svg>`);
    });

    it('#14', () => {
      runTest(convertPathData, `
<svg xmlns="http://www.w3.org/2000/svg">
    <path d="M0 0L0 0c2.761 0 5 2.239 5 5"/>
    <path d="M0 0L0 0c2.761 0 5 2.239 5 5l5-5"/>
    <path d="M15 10c-2.761 0-5-2.239-5-5s2.239-5 5-5s5 2.239 5 5l-5 5"/>
    <path d="M41.008 0.102c1.891 0.387 3.393 1.841 3.849 3.705"/>
    <path d="M7.234 19.474C6.562 19.811 5.803 20 5 20c-2.761 0-5-2.239-5-5 0-1.767 0.917-3.32 2.301-4.209"/>
    <path d="M60 0c-2.761 0-5 2.239-5 5s2.239 5 5 5s5-2.239 5-5S62.761 0 60 0z"/>
    <path d="M15 23.54 c-2.017,0 -3.87,-.7 -5.33,-1.87 -.032,-.023 -.068,-.052 -.11,-.087 .042,.035 .078,.064 .11,.087 .048,.04 .08,.063 .08,.063 "/>
    <path d="M-9.5,82.311c-2.657,0-4.81-2.152-4.81-4.811c0-2.656,2.153-4.811,4.81-4.811S-4.69,74.844-4.69,77.5 C-4.69,80.158-6.843,82.311-9.5,82.311z"/>
</svg>
`, `
<svg xmlns="http://www.w3.org/2000/svg">
    <path d="M0 0a5 5 0 0 1 5 5"/>
    <path d="M0 0a5 5 0 0 1 5 5l5-5"/>
    <path d="M15 10a5 5 0 1 1 5-5l-5 5"/>
    <path d="M41.008.102a5.006 5.006 0 0 1 3.849 3.705"/>
    <path d="M7.234 19.474a5 5 0 0 1-4.933-8.683"/>
    <path d="M60 0a5 5 0 1 0 .001 10.001A5 5 0 0 0 60 0z"/>
    <path d="M15 23.54a8.493 8.493 0 0 1-5.25-1.807"/>
    <path d="M-9.5 82.311a4.81 4.81 0 1 1 .002-9.622A4.81 4.81 0 0 1-9.5 82.31z"/>
</svg>`);
    });

    it('#15', () => {
      convertPathData.params.floatPrecision = 2;
      runTest(convertPathData, `
<svg xmlns="http://www.w3.org/2000/svg">
    <path d="M.49 8.8c-.3-.75-.44-1.55-.44-2.35 0-3.54 2.88-6.43 6.43-6.43 3.53 0 6.42 2.88 6.42 6.43 0 .8-.15 1.6-.43 2.35"/>
    <path d="M13.4 6.62c0-2.5-1.98-4.57-4.4-4.57S4.6 4.1 4.6 6.62"/>
</svg>
`, `
<svg xmlns="http://www.w3.org/2000/svg">
    <path d="M.49 8.8A6.44 6.44 0 0 1 6.48.02a6.44 6.44 0 0 1 5.99 8.78"/>
    <path d="M13.4 6.62c0-2.5-1.98-4.57-4.4-4.57S4.6 4.1 4.6 6.62"/>
</svg>`);
    });

    it('#16', () => {
      convertPathData.params.floatPrecision = 0;
      runTest(convertPathData, `
<svg xmlns="http://www.w3.org/2000/svg">
    <path d="M.49 8.8c-.3-.75-.44-1.55-.44-2.35 0-3.54 2.88-6.43 6.43-6.43 3.53 0 6.42 2.88 6.42 6.43 0 .8-.15 1.6-.43 2.35"/>
    <path d="M13.4 6.62c0-2.5-1.98-4.57-4.4-4.57S4.6 4.1 4.6 6.62"/>
</svg>
`, `
<svg xmlns="http://www.w3.org/2000/svg">
    <path d="M0 9V6a6 6 0 1 1 12 3"/>
    <path d="M13 7c0-3-2-5-4-5S5 4 5 7"/>
</svg>`);
    });

    it('#17', () => {
      convertPathData.params.floatPrecision = 8;
      runTest(convertPathData, `
<svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
    <path d="M33.027833,1.96545901 C33.097408,2.03503401 38.0413624,6.97898843 38.0413624,6.97898842 C38.0413625,6.97898834 38.0094318,4.0346712 38.0094318,4.0346712 L34,0.0252395624 L34,0 L13,0 L13,2 L33.062374,2 Z"></path>
</svg>
`, `
<svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
    <path d="M33.027833 1.96545901l5.0135294 5.01352941c1e-7-8e-8-.0319306-2.94431722-.0319306-2.94431722L34 .02523956V0H13v2h20.062374z"/>
</svg>`);
    });
  });

  describe('convertTransforms', () => {
    it('#1', () => {
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

    it('#2', () => {
      runTest(convertTransforms, `
<svg xmlns="http://www.w3.org/2000/svg">
    <g transform="translate(50 0) scale(2 2)"/>
    <g transform="translate(50) scale(2 2)"/>
    <g transform="translate(10 20) rotate(45) translate(-10-20)"/>
    <g transform="scale(2) translate(10 20) rotate(45) translate(-10-20)"/>
    <g transform="rotate(15) scale(2 1)"/>
    <g transform="scale(2 1) rotate(15)"/>
    <g transform="translate(10 20) rotate(45) translate(-10-20) scale(2)"/>
    <g transform="translate(15, 3) translate(13) rotate(47 39.885486 39.782373)"/>
</svg>
`, `
<svg xmlns="http://www.w3.org/2000/svg">
    <g transform="matrix(2 0 0 2 50 0)"/>
    <g transform="matrix(2 0 0 2 50 0)"/>
    <g transform="rotate(45 10 20)"/>
    <g transform="rotate(45 20 40) scale(2)"/>
    <g transform="rotate(15) scale(2 1)"/>
    <g transform="scale(2 1) rotate(15)"/>
    <g transform="rotate(45 10 20) scale(2)"/>
    <g transform="rotate(47 50.436 73.48)"/>
</svg>`);
    });

    it('#3', () => {
      runTest(convertTransforms, `
<svg xmlns="http://www.w3.org/2000/svg">
    <g transform="matrix(1 0 0 1 50 100)"/>
    <g transform="matrix(0.5 0 0 2 0 0)"/>
    <g transform="matrix(.707-.707.707.707 0 0)"/>
    <g transform="matrix(1 0 0.466 1 0 0)"/>
    <g transform="matrix(1 0.466 0 1 0 0)"/>
    <g transform="matrix(1 0 0 1 50 90) matrix(1 0 0 1 60 20) matrix(1 0 0 1 20 40)"/>
</svg>
`, `
<svg xmlns="http://www.w3.org/2000/svg">
    <g transform="translate(50 100)"/>
    <g transform="scale(.5 2)"/>
    <g transform="rotate(-45)"/>
    <g transform="skewX(24.99)"/>
    <g transform="skewY(24.99)"/>
    <g transform="translate(130 150)"/>
</svg>`);
    });

    it('#4', () => {
      runTest(convertTransforms, `
<svg xmlns="http://www.w3.org/2000/svg">
    <g transform=""/>
    <g transform="translate(0)"/>
    <g transform="translate(0 0)"/>
    <g transform="translate(0 50)"/>
    <g transform="scale(1)"/>
    <g transform="scale(1 2)"/>
    <g transform="rotate(0)"/>
    <g transform="rotate(0 100 100)"/>
    <g transform="skewX(0)"/>
    <g transform="skewY(0)"/>
    <g transform="translate(0,-100) translate(0,100)"/>
</svg>
`, `
<svg xmlns="http://www.w3.org/2000/svg">
    <g/>
    <g/>
    <g/>
    <g transform="translate(0 50)"/>
    <g/>
    <g transform="scale(1 2)"/>
    <g/>
    <g/>
    <g/>
    <g/>
    <g/>
</svg>`);
    });
  });

  describe('inlineStyles', () => {
    it('#xxx', () => {
      runTest(inlineStyles, `
<svg xmlns="http://www.w3.org/2000/svg" id="dark" viewBox="0 0 258.12 225.88">
<!-- for https://github.com/svg/svgo/pull/592#issuecomment-266327016 -->
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
<svg xmlns="http://www.w3.org/2000/svg" id="dark" viewBox="0 0 258.12 225.88">
<!--for https://github.com/svg/svgo/pull/592#issuecomment-266327016-->
    <path class="cls-7" style="cls-7-and-8:1;only-cls-7:1"/>
    <path d="M172.44 18.6c6.51-4.94 13 3.16 13 3.16l-14.57 10.09s-7.02-6.77 1.57-13.25z" class="cls-8" style="cls-7-and-8:1"/>
</svg>`);
    });
  });

  describe('mergePaths', () => {
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

  describe('convertShapeToPath', () => {
    it('#1', () => {
      runTest(convertShapeToPath, `
<svg xmlns="http://www.w3.org/2000/svg">
    <rect width="100%"/>
    <rect width="100%" height="100%"/>
    <rect x="25%" y="25%" width="50%" height="50%"/>
    <rect x="25pt" y="25pt" width="50pt" height="50pt"/>
    <rect x="10" y="10" width="50" height="50" rx="4"/>
    <rect x="0" y="0" width="20" height="20" ry="5"/>
    <rect width="32" height="32"/>
    <rect x="20" y="10" width="50" height="40"/>
    <rect fill="#666" x="10" y="10" width="10" height="10"/>
</svg>
`, `
<svg xmlns="http://www.w3.org/2000/svg">
    <rect width="100%"/>
    <rect width="100%" height="100%"/>
    <rect x="25%" y="25%" width="50%" height="50%"/>
    <rect x="25pt" y="25pt" width="50pt" height="50pt"/>
    <path d="M 14 10 H 56 A 4 4 0 0 1 60 14 V 56 A 4 4 0 0 1 56 60 H 14 A 4 4 0 0 1 10 56 V 14 A 4 4 0 0 1 14 10"/>
    <path d="M 5 0 H 15 A 5 5 0 0 1 20 5 V 15 A 5 5 0 0 1 15 20 H 5 A 5 5 0 0 1 0 15 V 5 A 5 5 0 0 1 5 0"/>
    <path d="M 0 0 H 32 V 32 H 0 Z"/>
    <path d="M 20 10 H 70 V 50 H 20 Z"/>
    <path fill="#666" d="M 10 10 H 20 V 20 H 10 Z"/>
</svg>
`);
    });

    it('#2', () => {
      runTest(convertShapeToPath, `
<svg xmlns="http://www.w3.org/2000/svg">
    <line x2="100%" y2="100%"/>
    <line x1="24" y2="24"/>
    <line x1="10" y1="10" x2="50" y2="20"/>
    <line stroke="#000" x1="10" y1="10" x2="50" y2="20"/>
</svg>
`, `
<svg xmlns="http://www.w3.org/2000/svg">
    <line x2="100%" y2="100%"/>
    <path d="M 24 0 L 0 24"/>
    <path d="M 10 10 L 50 20"/>
    <path stroke="#000" d="M 10 10 L 50 20"/>
</svg>
`);
    });

    it('#3', () => {
      runTest(convertShapeToPath, `
<svg xmlns="http://www.w3.org/2000/svg">
    <polyline points="10,10 20"/>
    <polyline points="10,80 20,50 50,20 80,10"/>
    <polyline points="20 ,10  50    40 30.5-1e-1 , 20 10"/>
    <polyline stroke="#000" points="10,10 20,20 10,20"/>
    <polygon points="10,10 20"/>
    <polygon points="10,80 20,50 50,20 80,10"/>
    <polygon points="20 10  50 40 30,20"/>
    <polygon stroke="#000" points="10,10 20,20 10,20"/>
    <polygon stroke="none" points="10,10 20,20 10,20"/>
</svg>
`, `
<svg xmlns="http://www.w3.org/2000/svg">
    <path d="M10 80L20 50 50 20 80 10"/>
    <path d="M20 10L50 40 30.5 -0.1 20 10"/>
    <path stroke="#000" d="M10 10L20 20 10 20"/>
    <path d="M10 80L20 50 50 20 80 10z"/>
    <path d="M20 10L50 40 30 20z"/>
    <path stroke="#000" d="M10 10L20 20 10 20z"/>
    <path stroke="none" d="M10 10L20 20 10 20z"/>
</svg>
`);
    });
  });

  describe('convertStyleToAttrs', () => {
    it('#1', () => {
      runTest(convertStyleToAttrs, `
<svg xmlns="http://www.w3.org/2000/svg">
    <g style="fill:#000;"/>
    <g style="font-family:'Helvetica Neue'"/>
    <g style="    fill:#000; color: #fff  ;  "/>
</svg>
`, `
<svg xmlns="http://www.w3.org/2000/svg">
    <g fill="#000"/>
    <g font-family="Helvetica Neue"/>
    <g fill="#000" color="#fff"/>
</svg>
`);
    });
    it('#2', () => {
      runTest(convertStyleToAttrs, `
<svg xmlns="http://www.w3.org/2000/svg">
    <g style="    fill:#000; c\olor: #fff; /**/illegal-'declaration/*'; -webkit-blah: 123  ; -webkit-trolo: 'lolo'; illegal2*/"/>
    <g style="font:15px serif"/>
</svg>
`, `
<svg xmlns="http://www.w3.org/2000/svg">
    <g style="-webkit-blah:123;-webkit-trolo:'lolo'" fill="#000" color="#fff"/>
    <g style="font:15px serif"/>
</svg>
`);
    });
    it('#3', () => {
      runTest(convertStyleToAttrs, `
<svg xmlns="http://www.w3.org/2000/svg">
    <g style="background/*-image*/:url(data:image/png;base64,iVBORw...)"/>
    <g style="fill:url(data:image/png;base64,iVBORw...)"/>
</svg>
`, `
<svg xmlns="http://www.w3.org/2000/svg">
    <g style="background:url(data:image/png;base64,iVBORw...)"/>
    <g fill="url(data:image/png;base64,iVBORw...)"/>
</svg>
`);
    });
  });

  describe('removeUselessStrokeAndFill', () => {
    it('#1', () => {
      removeUselessStrokeAndFill.params.removeNone = false;
      runTest(removeUselessStrokeAndFill, `
<svg xmlns="http://www.w3.org/2000/svg">
    <defs>
        <g id="test">
            <rect stroke-dashoffset="5" width="100" height="100"/>
        </g>
    </defs>
    <circle fill="red" stroke-width="6" stroke-dashoffset="5" cx="60" cy="60" r="50"/>
    <circle fill="red" stroke="#000" stroke-width="6" stroke-dashoffset="5" stroke-opacity="0" cx="60" cy="60" r="50"/>
    <circle fill="red" stroke="#000" stroke-width="0" stroke-dashoffset="5" cx="60" cy="60" r="50"/>
    <circle fill="red" stroke="#000" stroke-width="6" stroke-dashoffset="5" cx="60" cy="60" r="50"/>
    <g stroke="#000" stroke-width="6">
        <circle fill="red" stroke="red" stroke-width="0" stroke-dashoffset="5" cx="60" cy="60" r="50"/>
        <circle fill="red" stroke-dashoffset="5" cx="60" cy="60" r="50"/>
    </g>
    <g stroke="#000">
        <circle fill="red" stroke-width="0" stroke-dashoffset="5" cx="60" cy="60" r="50"/>
        <circle fill="red" stroke="none" stroke-dashoffset="5" cx="60" cy="60" r="50"/>
    </g>
</svg>
  `, `
<svg xmlns="http://www.w3.org/2000/svg">
    <defs>
        <g id="test">
            <rect stroke-dashoffset="5" width="100" height="100"/>
        </g>
    </defs>
    <circle fill="red" cx="60" cy="60" r="50"/>
    <circle fill="red" cx="60" cy="60" r="50"/>
    <circle fill="red" cx="60" cy="60" r="50"/>
    <circle fill="red" stroke="#000" stroke-width="6" stroke-dashoffset="5" cx="60" cy="60" r="50"/>
    <g stroke="#000" stroke-width="6">
        <circle fill="red" cx="60" cy="60" r="50" stroke="none"/>
        <circle fill="red" stroke-dashoffset="5" cx="60" cy="60" r="50"/>
    </g>
    <g stroke="#000">
        <circle fill="red" cx="60" cy="60" r="50" stroke="none"/>
        <circle fill="red" cx="60" cy="60" r="50" stroke="none"/>
    </g>
</svg>
`);
    });
    it('#2', () => {
      removeUselessStrokeAndFill.params.removeNone = false;
      runTest(removeUselessStrokeAndFill, `
<svg xmlns="http://www.w3.org/2000/svg">
    <defs>
        <g id="test">
            <rect fill-opacity=".5" width="100" height="100"/>
        </g>
    </defs>
    <circle fill="none" fill-rule="evenodd" cx="60" cy="60" r="50"/>
    <circle fill="red" fill-opacity="0" cx="90" cy="90" r="50"/>
    <circle fill-opacity="0" fill-rule="evenodd" cx="90" cy="60" r="50"/>
    <circle fill="red" fill-opacity=".5" cx="60" cy="60" r="50"/>
    <g fill="none">
        <circle fill-opacity=".5" cx="60" cy="60" r="50"/>
    </g>
</svg>
`, `
<svg xmlns="http://www.w3.org/2000/svg">
    <defs>
        <g id="test">
            <rect fill-opacity=".5" width="100" height="100"/>
        </g>
    </defs>
    <circle fill="none" cx="60" cy="60" r="50"/>
    <circle fill="none" cx="90" cy="90" r="50"/>
    <circle cx="90" cy="60" r="50" fill="none"/>
    <circle fill="red" fill-opacity=".5" cx="60" cy="60" r="50"/>
    <g fill="none">
        <circle cx="60" cy="60" r="50"/>
    </g>
</svg>
`);
    });
    it('#3', () => {
      removeUselessStrokeAndFill.params.removeNone = false;
      runTest(removeUselessStrokeAndFill, `
<svg xmlns="http://www.w3.org/2000/svg">
    <style>
        …
    </style>
    <circle fill="none" fill-rule="evenodd" cx="60" cy="60" r="50"/>
    <circle fill-opacity="0" fill-rule="evenodd" cx="90" cy="60" r="50"/>
    <circle fill="red" stroke-width="6" stroke-dashoffset="5" cx="60" cy="60" r="50"/>
    <circle fill="red" stroke="#000" stroke-width="6" stroke-dashoffset="5" stroke-opacity="0" cx="60" cy="60" r="50"/>
</svg>
`, `
<svg xmlns="http://www.w3.org/2000/svg">
    <style>
        …
    </style>
    <circle fill="none" fill-rule="evenodd" cx="60" cy="60" r="50"/>
    <circle fill-opacity="0" fill-rule="evenodd" cx="90" cy="60" r="50"/>
    <circle fill="red" stroke-width="6" stroke-dashoffset="5" cx="60" cy="60" r="50"/>
    <circle fill="red" stroke="#000" stroke-width="6" stroke-dashoffset="5" stroke-opacity="0" cx="60" cy="60" r="50"/>
</svg>
`);
    });
    it('#4', () => {
      removeUselessStrokeAndFill.params.removeNone = false;
      runTest(removeUselessStrokeAndFill, `
<svg xmlns="http://www.w3.org/2000/svg">
    <style>
        …
    </style>
    <circle fill="none" fill-rule="evenodd" cx="60" cy="60" r="50"/>
    <circle fill-opacity="0" fill-rule="evenodd" cx="90" cy="60" r="50"/>
    <circle fill="red" stroke-width="6" stroke-dashoffset="5" cx="60" cy="60" r="50"/>
    <circle fill="red" stroke="#000" stroke-width="6" stroke-dashoffset="5" stroke-opacity="0" cx="60" cy="60" r="50"/>
</svg>
`, `
<svg xmlns="http://www.w3.org/2000/svg">
    <style>
        …
    </style>
    <circle fill="none" fill-rule="evenodd" cx="60" cy="60" r="50"/>
    <circle fill-opacity="0" fill-rule="evenodd" cx="90" cy="60" r="50"/>
    <circle fill="red" stroke-width="6" stroke-dashoffset="5" cx="60" cy="60" r="50"/>
    <circle fill="red" stroke="#000" stroke-width="6" stroke-dashoffset="5" stroke-opacity="0" cx="60" cy="60" r="50"/>
</svg>
`);
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
  svg2js(svgText, svgJs => {
    if (svgJs.error) {
      console.warn('Failed to parse the specified SVG string.');
      callback(svgText);
      return;
    }
    callback(js2svg(executePlugins(svgJs, batchedSvgoPlugins(plugin)), {
      indent: '    ',
      pretty: true,
    }).data);
  });
}
