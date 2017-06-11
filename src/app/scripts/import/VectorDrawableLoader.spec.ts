import * as VectorDrawableLoader from './VectorDrawableLoader';

fdescribe('VectorDrawableLoader', () => {
  it(`Load animation`, () => {
    const xml = `
<animated-vector
    xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:aapt="http://schemas.android.com/aapt">
    <aapt:attr name="android:drawable">
        <vector
            android:name="root"
            android:width="100dp"
            android:height="200dp"
            android:viewportWidth="200"
            android:viewportHeight="400">
            <path
                android:name="horizon"
                android:pathData="M189,409.5C189,409.5 294.7,409.6 411.2,409.5C527.8,409.4 649.2,409 649.2,409"
                android:strokeColor="#E2E2E2"
                android:strokeLineCap="square"
                android:strokeWidth="1" />
        </vector>
    </aapt:attr>
    <target android:name="horizon">
        <aapt:attr name="android:animation">
            <objectAnimator
                android:propertyName="pathData"
                android:valueFrom="M414.2,238.1C429.7,265.4 442.3,278.5 442.3,294.6C442.3,310.7 429.7,323.8 414.2,323.8Z"
                android:valueTo="M412.7,324.3C428.2,266.3 440.8,279.3 440.8,295.3C440.8,311.3 428.2,324.3 412.7,324.3Z"
                android:startOffset="1620"
                android:duration="120"
                android:interpolator="@android:interpolator/fast_out_slow_in"
                android:valueType="pathType" />
        </aapt:attr>
    </target>
</animated-vector>
`;
    VectorDrawableLoader.loadAnimationFromXmlString(xml, 'anim', () => false);
  });
});
