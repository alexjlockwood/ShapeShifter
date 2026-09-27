import { findPreset } from 'app/modules/editor/model/interpolators';
import {
  type Transform,
  TRANSFORM_DEFAULTS,
  TRANSFORM_PROPERTY_NAMES,
} from 'app/modules/editor/model/layers';

// The transform properties that move a path. A pivot alone doesn't, so it needs no new version.
const PATH_TRANSFORM_KEYS: ReadonlyArray<keyof Transform> = TRANSFORM_PROPERTY_NAMES.filter(
  key => key !== 'pivotX' && key !== 'pivotY',
);

/**
 * The parsed (but not yet reconstructed into model objects) JSON shape that
 * `FileExportService.exportJSON` writes and `FileExportService.fromJSON` reads.
 */
export interface ProjectJson {
  readonly layers: { readonly vectorLayer: any };
  readonly timeline: { readonly animation: any };
}

/**
 * A rule that raises the version a project must be saved as, once its JSON contains something an
 * older build of Shape Shifter would silently drop or misread. A rule only ever raises the
 * version: a project that doesn't match any rule stays at version 1.
 */
export interface ProjectVersionRule {
  /** The version required once `test` matches. */
  readonly version: number;
  /** Returns true once the project's JSON needs this rule's version. */
  readonly test: (json: ProjectJson) => boolean;
}

/**
 * Format-change rules, in ascending version order. There's no migrations framework: a rule only
 * decides which version a file that already parses fine gets saved as, and `FileExportService`
 * loads every version's shape directly.
 *
 * Add a rule here (don't remove or renumber an existing one) when a format change needs one, per
 * `model/README.md`'s "Format-change rules" section:
 * - version 2 (custom interpolators): true once any animation block's `interpolator` string
 *   isn't one of the preset names in `INTERPOLATORS`, i.e. it's a curve written as canonical
 *   Android pathInterpolator path data.
 * - version 3 (transforms on paths): true once any path layer "uses its transform": its rotation,
 *   scale, or translate isn't the default, or it has a transform block. A pivot alone doesn't
 *   count.
 */
const VERSION_RULES: readonly ProjectVersionRule[] = [
  {
    // Builds before custom interpolators replace a curve with the default preset.
    version: 2,
    test: json => {
      const blocks = json.timeline.animation?.blocks;
      return (
        Array.isArray(blocks) &&
        blocks.some(b => typeof b?.interpolator === 'string' && !findPreset(b.interpolator))
      );
    },
  },
  {
    // Builds before transforms on paths ignore a path's transform, and drop its transform
    // blocks, so the path is drawn where its path data is.
    version: 3,
    test: json => {
      const pathIds = new Set<string>();
      let isTransformed = false;
      (function recurseFn(layer: any) {
        if (!layer || typeof layer !== 'object') {
          return;
        }
        if (layer.type === 'path') {
          pathIds.add(layer.id);
          isTransformed ||= PATH_TRANSFORM_KEYS.some(key => {
            // Loading replaces a missing value, or one that isn't a number, with the default.
            const value = layer[key] ?? TRANSFORM_DEFAULTS[key];
            return Number.isFinite(Number(value)) && Number(value) !== TRANSFORM_DEFAULTS[key];
          });
        }
        if (Array.isArray(layer.children)) {
          layer.children.forEach(recurseFn);
        }
      })(json.layers.vectorLayer);
      if (isTransformed) {
        return true;
      }
      const blocks = json.timeline.animation?.blocks;
      const transformNames: ReadonlySet<string> = new Set(TRANSFORM_PROPERTY_NAMES);
      return (
        Array.isArray(blocks) &&
        blocks.some(b => pathIds.has(b?.layerId) && transformNames.has(b?.propertyName))
      );
    },
  },
];

/**
 * The version this build saves ordinary projects as: the highest version any registered rule can
 * produce. Registering a new rule raises this automatically, so a file this build just saved
 * never trips its own newer-version warning.
 */
export const CURRENT_PROJECT_VERSION = VERSION_RULES.reduce(
  (max, rule) => Math.max(max, rule.version),
  1,
);

/** Thrown by `FileExportService.fromJSON` for JSON that isn't a project it can read. */
export class ProjectFormatError extends Error {}

/**
 * Shown by every caller of `FileExportService.fromJSON` when it returns `newerVersion: true`.
 */
export const NEWER_VERSION_WARNING =
  'This project was saved by a newer version of Shape Shifter. Some things may not show, and ' +
  'saving may drop them.';

/**
 * Returns the version a project's JSON must be saved as: 1, unless a registered rule's test
 * matches, in which case the highest version among the matching rules.
 */
export function getRequiredVersion(json: ProjectJson): number {
  let required = 1;
  for (const rule of VERSION_RULES) {
    if (rule.version > required && rule.test(json)) {
      required = rule.version;
    }
  }
  return required;
}
