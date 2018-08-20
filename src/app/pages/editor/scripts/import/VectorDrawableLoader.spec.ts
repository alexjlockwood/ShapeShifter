/* tslint:disable */

// import * as VectorDrawableLoader from './VectorDrawableLoader';

// fdescribe('VectorDrawableLoader', () => {
//   it(`Load animation`, () => {
//     const xml = `
// <animated-vector
//     xmlns:android="http://schemas.android.com/apk/res/android"
//     xmlns:aapt="http://schemas.android.com/aapt">

//     <!-- Vector drawable. -->
//     <aapt:attr name="android:drawable">
//         <vector
//             android:width="400dp"
//             android:height="300dp"
//             android:viewportWidth="800"
//             android:viewportHeight="600">
//             <path
//                 android:name="horizon"
//                 android:pathData="M189,409.5C189,409.5 294.7,409.6 411.2,409.5C527.8,409.4 649.2,409 649.2,409"
//                 android:strokeColor="#E2E2E2"
//                 android:strokeLineCap="square"
//                 android:strokeWidth="1" />
//             <group android:name="dots">
//                 <path
//                     android:name="dot_1"
//                     android:pathData="M363.5 409a9.5 9.5 0 0 1 -9.5 9.5 9.5 9.5 0 0 1 -9.5 -9.5 9.5 9.5 0 0 1 9.5 -9.5 9.5 9.5 0 0 1 9.5 9.5z"
//                     android:fillColor="#E2E2E2" />
//                 <path
//                     android:name="dot_2"
//                     android:pathData="M600 409a9.5 9.5 0 0 1 -9.5 9.5 9.5 9.5 0 0 1 -9.5 -9.5 9.5 9.5 0 0 1 9.5 -9.5 9.5 9.5 0 0 1 9.5 9.5z"
//                     android:fillColor="#E2E2E2" />
//                 <path
//                     android:name="dot_3"
//                     android:pathData="M843.5 409A16.5 16.5 0 0 1 827 425.5 16.5 16.5 0 0 1 810.5 409 16.5 16.5 0 0 1 827 392.5 16.5 16.5 0 0 1 843.5 409Z"
//                     android:fillColor="#F83E3E" />
//                 <path
//                     android:name="dot_4"
//                     android:pathData="M1073 409a9.5 9.5 0 0 1 -9.5 9.5 9.5 9.5 0 0 1 -9.5 -9.5 9.5 9.5 0 0 1 9.5 -9.5 9.5 9.5 0 0 1 9.5 9.5z"
//                     android:fillColor="#E2E2E2" />
//                 <path
//                     android:name="dot_5"
//                     android:pathData="M1319.5 409a9.5 9.5 0 0 1 -9.5 9.5 9.5 9.5 0 0 1 -9.5 -9.5 9.5 9.5 0 0 1 9.5 -9.5 9.5 9.5 0 0 1 9.5 9.5z"
//                     android:fillColor="#E2E2E2" />
//             </group>
//             <path
//                 android:name="pin"
//                 android:pathData="M412.7,238.9C381,238.9 356.8,261.8 356.8,294.6C356.8,329.7 407.7,408.7 409.2,408.8C410.7,408.9 469.4,328.1 469.4,294.6C469.4,261.8 444.5,238.9 412.7,238.9ZM412.7,324.3C397.2,324.3 384.7,311.3 384.7,295.3C384.7,279.3 397.2,266.3 412.7,266.3C428.2,266.3 440.8,279.3 440.8,295.3C440.8,311.3 428.2,324.3 412.7,324.3Z"
//                 android:fillColor="#F83E3E" />
//         </vector>
//     </aapt:attr>

//     <!-- Target #1 -->
//     <!--<target android:name="pin">
//         <aapt:attr name="android:animation">
//             <set android:ordering="together">
//                 <objectAnimator
//                     android:propertyName="pathData"
//                     android:valueFrom="M412.7,238.9C381,238.9 356.8,261.8 356.8,294.6C356.8,329.7 407.7,408.7 409.2,408.8C410.7,408.9 469.4,328.1 469.4,294.6C469.4,261.8 444.5,238.9 412.7,238.9ZM412.7,324.3C397.2,324.3 384.7,311.3 384.7,295.3C384.7,279.3 397.2,266.3 412.7,266.3C428.2,266.3 440.8,279.3 440.8,295.3C440.8,311.3 428.2,324.3 412.7,324.3Z"
//                     android:valueTo="M406.7,247.6C374.9,247.6 350.4,270.5 350.4,303.4C350.4,335.9 406.9,400.5 406.1,408.7C416,408.7 463.4,339.3 463.4,303.4C463.4,270.5 438.4,247.6 406.7,247.6ZM406.7,329.7C391.2,329.7 378.6,317.5 378.6,302.4C378.6,287.2 391.2,275 406.7,275C422.2,275 434.8,287.2 434.8,302.4C434.8,317.5 422.2,329.7 406.7,329.7Z"
//                     android:startOffset="0"
//                     android:duration="120"
//                     android:interpolator="@android:interpolator/linear_out_slow_in"
//                     android:valueType="pathType" />
//                 <objectAnimator
//                     android:propertyName="pathData"
//                     android:valueFrom="M406.7,247.6C374.9,247.6 350.4,270.5 350.4,303.4C350.4,335.9 406.9,400.5 406.1,408.7C416,408.7 463.4,339.3 463.4,303.4C463.4,270.5 438.4,247.6 406.7,247.6ZM406.7,329.7C391.2,329.7 378.6,317.5 378.6,302.4C378.6,287.2 391.2,275 406.7,275C422.2,275 434.8,287.2 434.8,302.4C434.8,317.5 422.2,329.7 406.7,329.7Z"
//                     android:valueTo="M414.2,238.1C382.4,238.1 357.9,261 357.9,293.8C357.9,326.3 402.5,408.3 403.9,408.3C405.3,408.3 471.4,330.5 471.4,293.8C471.4,261 445.9,238.1 414.2,238.1ZM414.2,323.8C398.7,323.8 386.1,310.7 386.1,294.6C386.1,278.5 398.7,265.4 414.2,265.4C429.7,265.4 442.3,278.5 442.3,294.6C442.3,310.7 429.7,323.8 414.2,323.8Z"
//                     android:startOffset="120"
//                     android:duration="120"
//                     android:interpolator="@android:interpolator/fast_out_slow_in"
//                     android:valueType="pathType" />
//                 <objectAnimator
//                     android:propertyName="pathData"
//                     android:valueFrom="M414.2,238.1C382.4,238.1 357.9,261 357.9,293.8C357.9,326.3 402.5,408.3 403.9,408.3C405.3,408.3 471.4,330.5 471.4,293.8C471.4,261 445.9,238.1 414.2,238.1ZM414.2,323.8C398.7,323.8 386.1,310.7 386.1,294.6C386.1,278.5 398.7,265.4 414.2,265.4C429.7,265.4 442.3,278.5 442.3,294.6C442.3,310.7 429.7,323.8 414.2,323.8Z"
//                     android:valueTo="M412.7,238.9C381,238.9 356.8,261.8 356.8,294.6C356.8,329.7 407.7,408.7 409.2,408.8C410.7,408.9 469.4,328.1 469.4,294.6C469.4,261.8 444.5,238.9 412.7,238.9ZM412.7,324.3C397.2,324.3 384.7,311.3 384.7,295.3C384.7,279.3 397.2,266.3 412.7,266.3C428.2,266.3 440.8,279.3 440.8,295.3C440.8,311.3 428.2,324.3 412.7,324.3Z3"
//                     android:startOffset="240"
//                     android:duration="120"
//                     android:interpolator="@android:interpolator/fast_out_slow_in"
//                     android:valueType="pathType" />
//                 <objectAnimator
//                     android:propertyName="pathData"
//                     android:valueFrom="M412.7,238.9C381,238.9 356.8,261.8 356.8,294.6C356.8,329.7 407.7,408.7 409.2,408.8C410.7,408.9 469.4,328.1 469.4,294.6C469.4,261.8 444.5,238.9 412.7,238.9ZM412.7,324.3C397.2,324.3 384.7,311.3 384.7,295.3C384.7,279.3 397.2,266.3 412.7,266.3C428.2,266.3 440.8,279.3 440.8,295.3C440.8,311.3 428.2,324.3 412.7,324.3Z3"
//                     android:valueTo="M412.7,238.9C381,238.9 356.8,261.8 356.8,294.6C356.8,329.7 407.7,408.7 409.2,408.8C410.7,408.9 469.4,328.1 469.4,294.6C469.4,261.8 444.5,238.9 412.7,238.9ZM412.7,324.3C397.2,324.3 384.7,311.3 384.7,295.3C384.7,279.3 397.2,266.3 412.7,266.3C428.2,266.3 440.8,279.3 440.8,295.3C440.8,311.3 428.2,324.3 412.7,324.3Z9"
//                     android:startOffset="360"
//                     android:duration="150"
//                     android:interpolator="@android:interpolator/fast_out_slow_in"
//                     android:valueType="pathType" />
//                 <objectAnimator
//                     android:propertyName="pathData"
//                     android:valueFrom="M412.7,238.9C381,238.9 356.8,261.8 356.8,294.6C356.8,329.7 407.7,408.7 409.2,408.8C410.7,408.9 469.4,328.1 469.4,294.6C469.4,261.8 444.5,238.9 412.7,238.9ZM412.7,324.3C397.2,324.3 384.7,311.3 384.7,295.3C384.7,279.3 397.2,266.3 412.7,266.3C428.2,266.3 440.8,279.3 440.8,295.3C440.8,311.3 428.2,324.3 412.7,324.3Z"
//                     android:valueTo="M412.7,238.9C381,238.9 356.8,261.8 356.8,294.6C356.8,329.7 407.7,408.7 409.2,408.8C410.7,408.9 469.4,328.1 469.4,294.6C469.4,261.8 444.5,238.9 412.7,238.9ZM412.7,324.3C397.2,324.3 384.7,311.3 384.7,295.3C384.7,279.3 397.2,266.3 412.7,266.3C428.2,266.3 440.8,279.3 440.8,295.3C440.8,311.3 428.2,324.3 412.7,324.3Z"
//                     android:startOffset="510"
//                     android:duration="180"
//                     android:interpolator="@android:interpolator/fast_out_linear_in"
//                     android:valueType="pathType" />
//                 <objectAnimator
//                     android:propertyName="pathData"
//                     android:valueFrom="M412.7,238.9C381,238.9 356.8,261.8 356.8,294.6C356.8,329.7 407.7,408.7 409.2,408.8C410.7,408.9 469.4,328.1 469.4,294.6C469.4,261.8 444.5,238.9 412.7,238.9ZM412.7,324.3C397.2,324.3 384.7,311.3 384.7,295.3C384.7,279.3 397.2,266.3 412.7,266.3C428.2,266.3 440.8,279.3 440.8,295.3C440.8,311.3 428.2,324.3 412.7,324.3Z"
//                     android:valueTo="M406.7,247.6C374.9,247.6 350.4,270.5 350.4,303.4C350.4,335.9 406.9,400.5 406.1,408.7C416,408.7 463.4,339.3 463.4,303.4C463.4,270.5 438.4,247.6 406.7,247.6ZM406.7,329.7C391.2,329.7 378.6,317.5 378.6,302.4C378.6,287.2 391.2,275 406.7,275C422.2,275 434.8,287.2 434.8,302.4C434.8,317.5 422.2,329.7 406.7,329.7Z"
//                     android:startOffset="690"
//                     android:duration="120"
//                     android:interpolator="@android:interpolator/linear_out_slow_in"
//                     android:valueType="pathType" />
//                 <objectAnimator
//                     android:propertyName="pathData"
//                     android:valueFrom="M406.7,247.6C374.9,247.6 350.4,270.5 350.4,303.4C350.4,335.9 406.9,400.5 406.1,408.7C416,408.7 463.4,339.3 463.4,303.4C463.4,270.5 438.4,247.6 406.7,247.6ZM406.7,329.7C391.2,329.7 378.6,317.5 378.6,302.4C378.6,287.2 391.2,275 406.7,275C422.2,275 434.8,287.2 434.8,302.4C434.8,317.5 422.2,329.7 406.7,329.7Z"
//                     android:valueTo="M414.2,238.1C382.4,238.1 357.9,261 357.9,293.8C357.9,326.3 402.5,408.3 403.9,408.3C405.3,408.3 471.4,330.5 471.4,293.8C471.4,261 445.9,238.1 414.2,238.1ZM414.2,323.8C398.7,323.8 386.1,310.7 386.1,294.6C386.1,278.5 398.7,265.4 414.2,265.4C429.7,265.4 442.3,278.5 442.3,294.6C442.3,310.7 429.7,323.8 414.2,323.8Z"
//                     android:startOffset="810"
//                     android:duration="120"
//                     android:interpolator="@android:interpolator/fast_out_slow_in"
//                     android:valueType="pathType" />
//                 <objectAnimator
//                     android:propertyName="pathData"
//                     android:valueFrom="M414.2,238.1C382.4,238.1 357.9,261 357.9,293.8C357.9,326.3 402.5,408.3 403.9,408.3C405.3,408.3 471.4,330.5 471.4,293.8C471.4,261 445.9,238.1 414.2,238.1ZM414.2,323.8C398.7,323.8 386.1,310.7 386.1,294.6C386.1,278.5 398.7,265.4 414.2,265.4C429.7,265.4 442.3,278.5 442.3,294.6C442.3,310.7 429.7,323.8 414.2,323.8Z"
//                     android:valueTo="M412.7,238.9C381,238.9 356.8,261.8 356.8,294.6C356.8,329.7 407.7,408.7 409.2,408.8C410.7,408.9 469.4,328.1 469.4,294.6C469.4,261.8 444.5,238.9 412.7,238.9ZM412.7,324.3C397.2,324.3 384.7,311.3 384.7,295.3C384.7,279.3 397.2,266.3 412.7,266.3C428.2,266.3 440.8,279.3 440.8,295.3C440.8,311.3 428.2,324.3 412.7,324.3Z"
//                     android:startOffset="930"
//                     android:duration="120"
//                     android:interpolator="@android:interpolator/fast_out_slow_in"
//                     android:valueType="pathType" />
//                 <objectAnimator
//                     android:propertyName="pathData"
//                     android:valueFrom="M412.7,238.9C381,238.9 356.8,261.8 356.8,294.6C356.8,329.7 407.7,408.7 409.2,408.8C410.7,408.9 469.4,328.1 469.4,294.6C469.4,261.8 444.5,238.9 412.7,238.9ZM412.7,324.3C397.2,324.3 384.7,311.3 384.7,295.3C384.7,279.3 397.2,266.3 412.7,266.3C428.2,266.3 440.8,279.3 440.8,295.3C440.8,311.3 428.2,324.3 412.7,324.3Z3"
//                     android:valueTo="M412.7,238.9C381,238.9 356.8,261.8 356.8,294.6C356.8,329.7 407.7,408.7 409.2,408.8C410.7,408.9 469.4,328.1 469.4,294.6C469.4,261.8 444.5,238.9 412.7,238.9ZM412.7,324.3C397.2,324.3 384.7,311.3 384.7,295.3C384.7,279.3 397.2,266.3 412.7,266.3C428.2,266.3 440.8,279.3 440.8,295.3C440.8,311.3 428.2,324.3 412.7,324.3Z"
//                     android:startOffset="1050"
//                     android:duration="150"
//                     android:interpolator="@android:interpolator/fast_out_slow_in"
//                     android:valueType="pathType" />
//                 <objectAnimator
//                     android:propertyName="pathData"
//                     android:valueFrom="M412.7,238.9C381,238.9 356.8,261.8 356.8,294.6C356.8,329.7 407.7,408.7 409.2,408.8C410.7,408.9 469.4,328.1 469.4,294.6C469.4,261.8 444.5,238.9 412.7,238.9ZM412.7,324.3C397.2,324.3 384.7,311.3 384.7,295.3C384.7,279.3 397.2,266.3 412.7,266.3C428.2,266.3 440.8,279.3 440.8,295.3C440.8,311.3 428.2,324.3 412.7,324.3Z"
//                     android:valueTo="M412.7,238.9C381,238.9 356.8,261.8 356.8,294.6C356.8,329.7 407.7,408.7 409.2,408.8C410.7,408.9 469.4,328.1 469.4,294.6C469.4,261.8 444.5,238.9 412.7,238.9ZM412.7,324.3C397.2,324.3 384.7,311.3 384.7,295.3C384.7,279.3 397.2,266.3 412.7,266.3C428.2,266.3 440.8,279.3 440.8,295.3C440.8,311.3 428.2,324.3 412.7,324.3Z"
//                     android:startOffset="1200"
//                     android:duration="180"
//                     android:interpolator="@android:interpolator/fast_out_linear_in"
//                     android:valueType="pathType" />
//                 <objectAnimator
//                     android:propertyName="pathData"
//                     android:valueFrom="M412.7,238.9C381,238.9 356.8,261.8 356.8,294.6C356.8,329.7 407.7,408.7 409.2,408.8C410.7,408.9 469.4,328.1 469.4,294.6C469.4,261.8 444.5,238.9 412.7,238.9ZM412.7,324.3C397.2,324.3 384.7,311.3 384.7,295.3C384.7,279.3 397.2,266.3 412.7,266.3C428.2,266.3 440.8,279.3 440.8,295.3C440.8,311.3 428.2,324.3 412.7,324.3Z"
//                     android:valueTo="M406.7,247.6C374.9,247.6 350.4,270.5 350.4,303.4C350.4,335.9 406.9,400.5 406.1,408.7C416,408.7 463.4,339.3 463.4,303.4C463.4,270.5 438.4,247.6 406.7,247.6ZM406.7,329.7C391.2,329.7 378.6,317.5 378.6,302.4C378.6,287.2 391.2,275 406.7,275C422.2,275 434.8,287.2 434.8,302.4C434.8,317.5 422.2,329.7 406.7,329.7Z"
//                     android:startOffset="1380"
//                     android:duration="120"
//                     android:interpolator="@android:interpolator/linear_out_slow_in"
//                     android:valueType="pathType" />
//                 <objectAnimator
//                     android:propertyName="pathData"
//                     android:valueFrom="M406.7,247.6C374.9,247.6 350.4,270.5 350.4,303.4C350.4,335.9 406.9,400.5 406.1,408.7C416,408.7 463.4,339.3 463.4,303.4C463.4,270.5 438.4,247.6 406.7,247.6ZM406.7,329.7C391.2,329.7 378.6,317.5 378.6,302.4C378.6,287.2 391.2,275 406.7,275C422.2,275 434.8,287.2 434.8,302.4C434.8,317.5 422.2,329.7 406.7,329.7Z"
//                     android:valueTo="M414.2,238.1C382.4,238.1 357.9,261 357.9,293.8C357.9,326.3 402.5,408.3 403.9,408.3C405.3,408.3 471.4,330.5 471.4,293.8C471.4,261 445.9,238.1 414.2,238.1ZM414.2,323.8C398.7,323.8 386.1,310.7 386.1,294.6C386.1,278.5 398.7,265.4 414.2,265.4C429.7,265.4 442.3,278.5 442.3,294.6C442.3,310.7 429.7,323.8 414.2,323.8Z"
//                     android:startOffset="1500"
//                     android:duration="120"
//                     android:interpolator="@android:interpolator/fast_out_slow_in"
//                     android:valueType="pathType" />
//                 <objectAnimator
//                     android:propertyName="pathData"
//                     android:valueFrom="M414.2,238.1C382.4,238.1 357.9,261 357.9,293.8C357.9,326.3 402.5,408.3 403.9,408.3C405.3,408.3 471.4,330.5 471.4,293.8C471.4,261 445.9,238.1 414.2,238.1ZM414.2,323.8C398.7,323.8 386.1,310.7 386.1,294.6C386.1,278.5 398.7,265.4 414.2,265.4C429.7,265.4 442.3,278.5 442.3,294.6C442.3,310.7 429.7,323.8 414.2,323.8Z"
//                     android:valueTo="M412.7,238.9C381,238.9 356.8,261.8 356.8,294.6C356.8,329.7 407.7,408.7 409.2,408.8C410.7,408.9 469.4,328.1 469.4,294.6C469.4,261.8 444.5,238.9 412.7,238.9ZM412.7,324.3C397.2,324.3 384.7,311.3 384.7,295.3C384.7,279.3 397.2,266.3 412.7,266.3C428.2,266.3 440.8,279.3 440.8,295.3C440.8,311.3 428.2,324.3 412.7,324.3Z"
//                     android:startOffset="1620"
//                     android:duration="120"
//                     android:interpolator="@android:interpolator/fast_out_slow_in"
//                     android:valueType="pathType" />
//                 <objectAnimator
//                     android:propertyName="pathData"
//                     android:valueFrom="M412.7,238.9C381,238.9 356.8,261.8 356.8,294.6C356.8,329.7 407.7,408.7 409.2,408.8C410.7,408.9 469.4,328.1 469.4,294.6C469.4,261.8 444.5,238.9 412.7,238.9ZM412.7,324.3C397.2,324.3 384.7,311.3 384.7,295.3C384.7,279.3 397.2,266.3 412.7,266.3C428.2,266.3 440.8,279.3 440.8,295.3C440.8,311.3 428.2,324.3 412.7,324.3Z"
//                     android:valueTo="M412.7,238.9C381,238.9 356.8,261.8 356.8,294.6C356.8,329.7 407.7,408.7 409.2,408.8C410.7,408.9 469.4,328.1 469.4,294.6C469.4,261.8 444.5,238.9 412.7,238.9ZM412.7,324.3C397.2,324.3 384.7,311.3 384.7,295.3C384.7,279.3 397.2,266.3 412.7,266.3C428.2,266.3 440.8,279.3 440.8,295.3C440.8,311.3 428.2,324.3 412.7,324.3Z"
//                     android:startOffset="1740"
//                     android:duration="150"
//                     android:interpolator="@android:interpolator/fast_out_slow_in"
//                     android:valueType="pathType" />
//                 <objectAnimator
//                     android:propertyName="pathData"
//                     android:valueFrom="M412.7,238.9C381,238.9 356.8,261.8 356.8,294.6C356.8,329.7 407.7,408.7 409.2,408.8C410.7,408.9 469.4,328.1 469.4,294.6C469.4,261.8 444.5,238.9 412.7,238.9ZM412.7,324.3C397.2,324.3 384.7,311.3 384.7,295.3C384.7,279.3 397.2,266.3 412.7,266.3C428.2,266.3 440.8,279.3 440.8,295.3C440.8,311.3 428.2,324.3 412.7,324.3Z"
//                     android:valueTo="M412.7,238.9C381,238.9 356.8,261.8 356.8,294.6C356.8,329.7 407.7,408.7 409.2,408.8C410.7,408.9 469.4,328.1 469.4,294.6C469.4,261.8 444.5,238.9 412.7,238.9ZM412.7,324.3C397.2,324.3 384.7,311.3 384.7,295.3C384.7,279.3 397.2,266.3 412.7,266.3C428.2,266.3 440.8,279.3 440.8,295.3C440.8,311.3 428.2,324.3 412.7,324.3Z"
//                     android:startOffset="1890"
//                     android:duration="180"
//                     android:interpolator="@android:interpolator/fast_out_linear_in"
//                     android:valueType="pathType" />
//             </set>
//         </aapt:attr>
//     </target>-->

//     <!-- Target #2 -->
//     <target android:name="dots">
//         <aapt:attr name="android:animation">
//             <objectAnimator
//                 android:propertyName="translateX"
//                 android:valueFrom="0"
//                 android:valueTo="-710"
//                 android:duration="2070"
//                 android:interpolator="@android:anim/linear_interpolator" />
//         </aapt:attr>
//     </target>

//     <!-- Target #3 -->
//     <!--<target android:name="dot_1">
//         <aapt:attr name="android:animation">
//             <set>
//                 <objectAnimator
//                     android:propertyName="fillAlpha"
//                     android:valueFrom="1"
//                     android:valueTo="1"
//                     android:duration="0" />
//                 <objectAnimator
//                     android:propertyName="fillAlpha"
//                     android:valueFrom="1"
//                     android:valueTo="0"
//                     android:startOffset="460"
//                     android:duration="60"
//                     android:interpolator="@android:anim/linear_interpolator" />
//             </set>
//         </aapt:attr>
//     </target>-->

//     <!-- Target #4 -->
//     <target android:name="dot_2">
//         <aapt:attr name="android:animation">
//             <!--<set>
//                 <objectAnimator
//                     android:propertyName="fillAlpha"
//                     android:valueFrom="1"
//                     android:valueTo="1"
//                     android:duration="0" />-->
//                 <objectAnimator
//                     android:propertyName="fillAlpha"
//                     android:valueFrom="1"
//                     android:valueTo="0"
//                     android:startOffset="1150"
//                     android:duration="60"
//                     android:interpolator="@android:anim/linear_interpolator" />
//             <!--</set>-->
//         </aapt:attr>
//     </target>

//     <!-- Target #5 -->
//     <!--<target android:name="dot_3">
//         <aapt:attr name="android:animation">
//             <set>
//                 <objectAnimator
//                     android:propertyName="fillAlpha"
//                     android:valueFrom="0"
//                     android:valueTo="0"
//                     android:duration="0" />
//                 <objectAnimator
//                     android:propertyName="fillAlpha"
//                     android:valueFrom="0"
//                     android:valueTo="1"
//                     android:startOffset="420"
//                     android:duration="60"
//                     android:interpolator="@android:anim/linear_interpolator" />
//                 <objectAnimator
//                     android:propertyName="fillAlpha"
//                     android:valueFrom="1"
//                     android:valueTo="0"
//                     android:startOffset="1840"
//                     android:duration="60"
//                     android:interpolator="@android:anim/linear_interpolator" />
//             </set>
//         </aapt:attr>
//     </target>-->

//     <!-- Target #6 -->
//     <target android:name="dot_4">
//         <aapt:attr name="android:animation">
//             <!--<set>
//                 <objectAnimator
//                     android:propertyName="fillAlpha"
//                     android:valueFrom="0"
//                     android:valueTo="0"
//                     android:duration="0" />-->
//                 <objectAnimator
//                     android:propertyName="fillAlpha"
//                     android:valueFrom="0"
//                     android:valueTo="1"
//                     android:startOffset="1170"
//                     android:duration="60"
//                     android:interpolator="@android:anim/linear_interpolator" />
//             <!--</set>-->
//         </aapt:attr>
//     </target>

//     <!-- Target #7 -->
//     <target android:name="dot_5">
//         <aapt:attr name="android:animation">
//             <!--<set>
//                 <objectAnimator
//                     android:propertyName="fillAlpha"
//                     android:valueFrom="0"
//                     android:valueTo="0"
//                     android:duration="0" />-->
//                 <objectAnimator
//                     android:propertyName="fillAlpha"
//                     android:valueFrom="0"
//                     android:valueTo="1"
//                     android:startOffset="1900"
//                     android:duration="60"
//                     android:interpolator="@android:anim/linear_interpolator" />
//             <!--</set>-->
//         </aapt:attr>
//     </target>
// </animated-vector>
// `;
//     VectorDrawableLoader.loadAnimationFromXmlString(xml, 'anim', () => false);
//   });
// });
