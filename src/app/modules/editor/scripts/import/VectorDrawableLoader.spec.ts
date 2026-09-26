import { VectorDrawableLoader } from '.';

describe('VectorDrawableLoader', () => {
  it('names layers after their types if nothing is left of their names', () => {
    const xml = `
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:name="矢量"
    android:width="24dp"
    android:height="24dp"
    android:viewportWidth="24"
    android:viewportHeight="24">
  <group android:name="图层">
    <clip-path android:name="剪辑" android:pathData="M 0 0 L 10 0 L 10 10 Z"/>
    <path android:name="路径一" android:fillColor="#f00" android:pathData="M 0 0 L 10 10 L 0 10 Z"/>
    <path android:name="路径二" android:fillColor="#00f" android:pathData="M 0 0 L 5 5 L 0 5 Z"/>
  </group>
</vector>
`;
    const vl = VectorDrawableLoader.loadVectorLayerFromXmlString(xml, () => false)!;
    expect(vl.name).toBe('vector');
    expect(vl.children.map(l => l.name)).toEqual(['group']);
    expect(vl.children[0].children.map(l => l.name)).toEqual(['clip_path', 'path', 'path_1']);
  });
});
