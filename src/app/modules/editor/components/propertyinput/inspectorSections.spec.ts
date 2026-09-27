import { ClipPathLayer, GroupLayer, PathLayer, VectorLayer } from 'app/modules/editor/model/layers';
import { Path } from 'app/modules/editor/model/paths';
import { NumberProperty } from 'app/modules/editor/model/properties';
import {
  Animation,
  AnimationBlock,
  ColorAnimationBlock,
  NumberAnimationBlock,
  PathAnimationBlock,
} from 'app/modules/editor/model/timeline';
import { describe, expect, it } from 'vitest';

import { InspectedProperty } from './InspectedProperty';
import {
  buildInspectorSections,
  getSectionId,
  PROPERTY_PLACEMENTS,
  type SectionOptions,
} from './inspectorSections';

/** The inspected properties of a model, as the inspector builds them. */
function inspect(model: any) {
  return Array.from(
    model.inspectableProperties as Map<string, any>,
    ([name, property]) => new InspectedProperty<any>(model, property, name, new Map(), () => {}),
  );
}

function optionsFor(model: any, animated: string[] = []): SectionOptions {
  return {
    animatablePropertyNames: new Set(model.animatableProperties?.keys() ?? []),
    animatedPropertyNames: new Set(animated),
  };
}

function summarize(sections: ReturnType<typeof buildInspectorSections>) {
  return sections.map(s => [s.id, s.rows.map(r => r.label)]);
}

function newPath(extra: object = {}) {
  return new PathLayer({
    name: 'path',
    children: [],
    pathData: new Path('M 0 0 L 10 10'),
    ...extra,
  });
}

describe('PROPERTY_PLACEMENTS', () => {
  it('places every property that the layers, blocks, and animations register', () => {
    const classes = [
      VectorLayer,
      GroupLayer,
      ClipPathLayer,
      PathLayer,
      PathAnimationBlock,
      ColorAnimationBlock,
      NumberAnimationBlock,
      Animation,
    ];
    const missing = classes.flatMap(cls =>
      Array.from((cls.prototype as any).inspectableProperties.keys() as Iterable<string>)
        .filter(name => !PROPERTY_PLACEMENTS[name])
        .map(name => `${cls.name}.${name}`),
    );
    expect(missing).toEqual([]);
  });

  it('puts the transform properties in Transform, whatever has them', () => {
    for (const name of ['rotation', 'scaleX', 'scaleY', 'pivotX', 'pivotY', 'translateX']) {
      expect(getSectionId(name)).toBe('transform');
    }
    expect(getSectionId('translateY')).toBe('transform');
  });
});

describe('buildInspectorSections', () => {
  it("groups a path's properties into sections of rows", () => {
    const path = newPath({ strokeLinejoin: 'miter' });
    expect(summarize(buildInspectorSections(inspect(path), optionsFor(path)))).toEqual([
      ['name', ['Name']],
      ['fill', ['Color', 'Alpha', 'Rule']],
      ['stroke', ['Color', 'Alpha', 'Width', 'Cap', 'Join', 'Miter limit']],
      ['trimPath', ['Start', 'End', 'Offset']],
      ['path', ['Path']],
    ]);
  });

  it('only shows the miter limit for miter joins', () => {
    const path = newPath({ strokeLinejoin: 'round' });
    const stroke = buildInspectorSections(inspect(path), optionsFor(path)).find(
      s => s.id === 'stroke',
    );
    expect(stroke?.rows.map(r => r.label)).toEqual(['Color', 'Alpha', 'Width', 'Cap', 'Join']);
  });

  it("shares rows between a group's x and y properties, with their own labels", () => {
    const group = new GroupLayer({ name: 'group', children: [] });
    const [, transform] = buildInspectorSections(inspect(group), optionsFor(group));
    expect(transform.title).toBe('Transform');
    expect(
      transform.rows.map(r => [r.label, r.fields.map(f => [f.ip.propertyName, f.label])]),
    ).toEqual([
      ['Rotation', [['rotation', undefined]]],
      [
        'Scale',
        [
          ['scaleX', 'X'],
          ['scaleY', 'Y'],
        ],
      ],
      [
        'Pivot',
        [
          ['pivotX', 'X'],
          ['pivotY', 'Y'],
        ],
      ],
      [
        'Translate',
        [
          ['translateX', 'X'],
          ['translateY', 'Y'],
        ],
      ],
    ]);
  });

  it("orders the vector layer's rows as Size, Background, and Opacity", () => {
    const vl = new VectorLayer({ name: 'vector', children: [] });
    expect(summarize(buildInspectorSections(inspect(vl), optionsFor(vl)))).toEqual([
      ['name', ['Name']],
      ['document', ['Size', 'Background', 'Opacity']],
    ]);
  });

  it('only gives rows of properties that can be animated an animate button', () => {
    const path = newPath();
    const sections = buildInspectorSections(inspect(path), optionsFor(path, ['fillAlpha']));
    const rows = sections.flatMap(s => s.rows);
    const animation = (id: string) => rows.find(r => r.id === id)?.animation;
    expect(animation('fillAlpha')).toEqual({
      propertyNames: ['fillAlpha'],
      animatedPropertyNames: ['fillAlpha'],
    });
    expect(animation('fillColor')).toEqual({
      propertyNames: ['fillColor'],
      animatedPropertyNames: [],
    });
    for (const id of ['name', 'fillType', 'strokeLinecap', 'strokeLinejoin', 'strokeMiterLimit']) {
      expect(animation(id)).toBeUndefined();
    }
  });

  it('collapses Trim path while it trims nothing', () => {
    const isCollapsed = (path: PathLayer, animated: string[] = []) =>
      buildInspectorSections(inspect(path), optionsFor(path, animated)).find(
        s => s.id === 'trimPath',
      )?.isCollapsedByDefault;
    expect(isCollapsed(newPath())).toBe(true);
    expect(isCollapsed(newPath({ trimPathEnd: 0.5 }))).toBe(false);
    expect(isCollapsed(newPath(), ['trimPathOffset'])).toBe(false);
  });

  it("puts a block's properties in Keyframe, with the easing curve under its label", () => {
    const block = AnimationBlock.from({
      layerId: 'layer',
      propertyName: 'alpha',
      type: 'number',
      startTime: 0,
      endTime: 100,
      fromValue: 0,
      toValue: 1,
    });
    const sections = buildInspectorSections(inspect(block), optionsFor(block));
    expect(summarize(sections)).toEqual([['keyframe', ['Time', 'Easing', 'From', 'To']]]);
    expect(sections[0].rows.map(r => r.isWide)).toEqual([false, true, false, false]);
    expect(sections[0].rows.every(r => !r.animation)).toBe(true);
  });

  it("puts the animation's name in its Animation section", () => {
    const animation = new Animation();
    expect(
      summarize(
        buildInspectorSections(inspect(animation), {
          ...optionsFor(animation),
          isAnimation: true,
        }),
      ),
    ).toEqual([['animation', ['Name', 'Duration']]]);
  });

  it('leaves out excluded properties, and shows properties it has no place for', () => {
    const path = newPath();
    const unplaced = new InspectedProperty<number>(
      { futureThing: 1 },
      new NumberProperty('futureThing'),
      'futureThing',
      new Map(),
      () => {},
    );
    const sections = buildInspectorSections([...inspect(path), unplaced], {
      ...optionsFor(path),
      excludedPropertyNames: new Set(['pathData']),
    });
    expect(sections.find(s => s.id === 'path')).toBeUndefined();
    expect(sections[sections.length - 1]).toMatchObject({
      id: 'other',
      title: 'Other',
      rows: [{ label: 'futureThing' }],
    });
  });
});
