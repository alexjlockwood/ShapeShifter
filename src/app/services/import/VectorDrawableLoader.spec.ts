// import * as VectorDrawableLoader from './VectorDrawableLoader';

// fdescribe('VectorDrawableLoader', () => {
//   it(`Load animation`, () => {
//     const xml = `
// <animated-vector
//     xmlns:android="http://schemas.android.com/apk/res/android"
//     xmlns:aapt="http://schemas.android.com/aapt">
//     <aapt:attr name="android:drawable">
//         <vector
//             android:name="root"
//             android:width="100dp"
//             android:height="200dp"
//             android:viewportWidth="200"
//             android:viewportHeight="400">
//         </vector>
//     </aapt:attr>
//     <target android:name="root">
//         <aapt:attr name="android:animation">
//             <objectAnimator
//                 android:propertyName="alpha"
//                 android:valueFrom="0"
//                 android:valueTo="0"
//                 android:duration="0" />
//         </aapt:attr>
//     </target>
// </animated-vector>
// `;
//     VectorDrawableLoader.loadAnimationFromXmlString(xml, 'anim', () => false);
//   });
// });
