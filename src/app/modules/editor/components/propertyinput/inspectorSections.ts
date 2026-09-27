import { sortBy } from 'lodash-es';

import type { InspectedProperty } from './InspectedProperty';

// The property inspector groups properties into sections of compact rows, like Figma's design
// panel. Where each property goes is a static map keyed by the property's name alone, so that a
// property any model registers under a known name lands in the same place: e.g. the transform
// properties go in Transform whether a group or a path has them.

export type SectionId =
  | 'name'
  | 'document'
  | 'layout'
  | 'transform'
  | 'fill'
  | 'stroke'
  | 'trimPath'
  | 'path'
  | 'keyframe'
  | 'animation'
  // Properties that aren't in PROPERTY_PLACEMENTS yet.
  | 'other';

/** Where a property goes: its section, the row it shares, and its label within the row. */
export interface PropertyPlacement {
  readonly section: SectionId;
  /** The row's label. Properties with the same one share a row, in the order they're registered. */
  readonly row: string;
  /** A short label for the property's own field, in a row with several, e.g. 'X' in Scale. */
  readonly field?: string;
}

export const PROPERTY_PLACEMENTS: Readonly<Record<string, PropertyPlacement>> = {
  // Layers and animations.
  name: { section: 'name', row: 'Name' },
  // The vector layer.
  width: { section: 'document', row: 'Size', field: 'W' },
  height: { section: 'document', row: 'Size', field: 'H' },
  canvasColor: { section: 'document', row: 'Background' },
  alpha: { section: 'document', row: 'Opacity' },
  // Groups, and paths once they have transforms too.
  rotation: { section: 'transform', row: 'Rotation' },
  scaleX: { section: 'transform', row: 'Scale', field: 'X' },
  scaleY: { section: 'transform', row: 'Scale', field: 'Y' },
  pivotX: { section: 'transform', row: 'Pivot', field: 'X' },
  pivotY: { section: 'transform', row: 'Pivot', field: 'Y' },
  translateX: { section: 'transform', row: 'Translate', field: 'X' },
  translateY: { section: 'transform', row: 'Translate', field: 'Y' },
  // Paths and clip paths.
  pathData: { section: 'path', row: 'Path' },
  fillColor: { section: 'fill', row: 'Color' },
  fillAlpha: { section: 'fill', row: 'Alpha' },
  fillType: { section: 'fill', row: 'Rule' },
  strokeColor: { section: 'stroke', row: 'Color' },
  strokeAlpha: { section: 'stroke', row: 'Alpha' },
  strokeWidth: { section: 'stroke', row: 'Width' },
  strokeLinecap: { section: 'stroke', row: 'Cap' },
  strokeLinejoin: { section: 'stroke', row: 'Join' },
  strokeMiterLimit: { section: 'stroke', row: 'Miter limit' },
  trimPathStart: { section: 'trimPath', row: 'Start' },
  trimPathEnd: { section: 'trimPath', row: 'End' },
  trimPathOffset: { section: 'trimPath', row: 'Offset' },
  // Animation blocks.
  startTime: { section: 'keyframe', row: 'Time', field: 'Start' },
  endTime: { section: 'keyframe', row: 'Time', field: 'End' },
  interpolator: { section: 'keyframe', row: 'Easing' },
  fromValue: { section: 'keyframe', row: 'From' },
  toValue: { section: 'keyframe', row: 'To' },
  // Animations.
  duration: { section: 'animation', row: 'Duration' },
};

const SECTION_TITLES: Readonly<Record<SectionId, string | undefined>> = {
  // The name goes right under the header, without a title of its own.
  name: undefined,
  document: 'Document',
  layout: 'Layout',
  transform: 'Transform',
  fill: 'Fill',
  stroke: 'Stroke',
  trimPath: 'Trim path',
  path: 'Path',
  keyframe: 'Keyframe',
  animation: 'Animation',
  other: 'Other',
};

/** The order sections are shown in. */
export const SECTION_ORDER: ReadonlyArray<SectionId> = [
  'name',
  'document',
  'layout',
  'transform',
  'fill',
  'stroke',
  'trimPath',
  'path',
  'keyframe',
  'animation',
  'other',
];

// The trim properties' defaults, which draw the whole path.
const TRIM_DEFAULTS: Readonly<Record<string, number>> = {
  trimPathStart: 0,
  trimPathEnd: 1,
  trimPathOffset: 0,
};

/** A property's field in a row. */
export interface InspectorField {
  readonly ip: InspectedProperty<any>;
  /** A short label, in a row with several fields. */
  readonly label?: string;
}

/** What a row's animate button does (see getRowAnimation). */
export interface RowAnimation {
  /** The row's properties that can be animated, which get blocks from the button. */
  readonly propertyNames: ReadonlyArray<string>;
  /** Those that already have blocks, which the button marks. */
  readonly animatedPropertyNames: ReadonlyArray<string>;
}

export interface InspectorRow {
  /** Unique in its section: its first property's name. */
  readonly id: string;
  readonly label: string;
  readonly fields: ReadonlyArray<InspectorField>;
  /** Only for rows with properties that can be animated. */
  readonly animation?: RowAnimation;
  /** Whether the field goes under the label rather than next to it, like the easing curve. */
  readonly isWide: boolean;
}

export interface InspectorSection {
  readonly id: SectionId;
  readonly title: string | undefined;
  readonly rows: ReadonlyArray<InspectorRow>;
  /** Whether it starts collapsed, e.g. Trim path while it doesn't trim anything. */
  readonly isCollapsedByDefault: boolean;
}

/** What buildInspectorSections needs to know about what's inspected, besides its properties. */
export interface SectionOptions {
  /**
   * The properties that can be animated, which get animate buttons. Empty for blocks and the
   * animation, whose properties can't be.
   */
  readonly animatablePropertyNames: ReadonlySet<string>;
  /** The properties that have blocks already. */
  readonly animatedPropertyNames: ReadonlySet<string>;
  /** Whether it's the animation, whose name goes in its Animation section. */
  readonly isAnimation?: boolean;
  /** Properties to leave out, e.g. the path while its points are edited. */
  readonly excludedPropertyNames?: ReadonlySet<string>;
}

/** Returns the section a property goes in, or undefined for a property that isn't in the map. */
export function getSectionId(
  propertyName: string,
  { isAnimation = false } = {},
): SectionId | undefined {
  const section = PROPERTY_PLACEMENTS[propertyName]?.section;
  return isAnimation && section === 'name' ? 'animation' : section;
}

/**
 * Groups the properties into sections of rows, in SECTION_ORDER, and each section's rows in the
 * order of PROPERTY_PLACEMENTS. Properties missing from PROPERTY_PLACEMENTS go in rows of
 * their own, named after them, in an Other section at the end, so that a new property still shows
 * up before it's placed. The Layout section isn't made of properties, so it's left to the inspector.
 *
 * Nothing here reads a model, only the inspected properties, so the same sections can be built
 * for properties that span several models (e.g. with a "Mixed" value).
 */
export function buildInspectorSections(
  properties: ReadonlyArray<InspectedProperty<any>>,
  options: SectionOptions,
): InspectorSection[] {
  const excluded = options.excludedPropertyNames ?? new Set<string>();
  const rowsBySection = new Map<SectionId, Map<string, InspectorField[]>>();
  for (const ip of properties) {
    if (excluded.has(ip.propertyName) || !isShown(ip, properties)) {
      continue;
    }
    const placement = PROPERTY_PLACEMENTS[ip.propertyName];
    const sectionId =
      getSectionId(ip.propertyName, { isAnimation: options.isAnimation }) ?? 'other';
    const rowLabel = placement?.row ?? ip.propertyName;
    let rows = rowsBySection.get(sectionId);
    if (!rows) {
      rows = new Map();
      rowsBySection.set(sectionId, rows);
    }
    rows.set(rowLabel, [...(rows.get(rowLabel) ?? []), { ip, label: placement?.field }]);
  }
  return SECTION_ORDER.flatMap(id => {
    const rows = rowsBySection.get(id);
    if (!rows) {
      return [];
    }
    return [
      {
        id,
        title: SECTION_TITLES[id],
        rows: sortBy(Array.from(rows), ([, fields]) => getPlacementIndex(fields[0])).map(
          ([label, fields]) => buildRow(label, fields, options),
        ),
        isCollapsedByDefault:
          id === 'trimPath' && isTrimAtDefaults(Array.from(rows.values()).flat(), options),
      },
    ];
  });
}

const PLACEMENT_ORDER = Object.keys(PROPERTY_PLACEMENTS);

/** Rows go in the order of PROPERTY_PLACEMENTS, and properties missing from it after them. */
function getPlacementIndex({ ip }: InspectorField) {
  const index = PLACEMENT_ORDER.indexOf(ip.propertyName);
  return index < 0 ? PLACEMENT_ORDER.length : index;
}

function buildRow(
  label: string,
  fields: ReadonlyArray<InspectorField>,
  options: SectionOptions,
): InspectorRow {
  const propertyNames = fields
    .map(f => f.ip.propertyName)
    .filter(name => options.animatablePropertyNames.has(name));
  return {
    id: fields[0].ip.propertyName,
    label,
    // A field of its own doesn't need a label next to the row's.
    fields: fields.length === 1 ? [{ ip: fields[0].ip }] : fields,
    animation: propertyNames.length
      ? {
          propertyNames,
          animatedPropertyNames: propertyNames.filter(n => options.animatedPropertyNames.has(n)),
        }
      : undefined,
    isWide: fields.some(f => f.ip.typeName === 'InterpolatorProperty'),
  };
}

/** The miter limit only matters for miter joins, so it's only shown for them. */
function isShown(ip: InspectedProperty<any>, properties: ReadonlyArray<InspectedProperty<any>>) {
  if (ip.propertyName !== 'strokeMiterLimit') {
    return true;
  }
  const join = properties.find(p => p.propertyName === 'strokeLinejoin');
  return !join || join.value === 'miter';
}

function isTrimAtDefaults(fields: ReadonlyArray<InspectorField>, options: SectionOptions) {
  return fields.every(
    ({ ip }) =>
      !options.animatedPropertyNames.has(ip.propertyName) &&
      ip.value === TRIM_DEFAULTS[ip.propertyName],
  );
}
