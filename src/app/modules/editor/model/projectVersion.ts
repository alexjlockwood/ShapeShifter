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
 * - version 2 (1E, custom interpolators): true once any animation block's `interpolator` string
 *   isn't one of the preset names in `INTERPOLATORS`, i.e. it's a curve written as canonical
 *   Android pathInterpolator path data.
 * - version 3 (2B, path transforms): true once any path layer "uses its transform": its rotation,
 *   scale, or translate isn't the default, or it has a transform block. A pivot alone doesn't
 *   count.
 */
const VERSION_RULES: readonly ProjectVersionRule[] = [];

/**
 * The version this build saves ordinary projects as: the highest version any registered rule can
 * produce. Registering a new rule raises this automatically, so a file this build just saved
 * never trips its own newer-version warning.
 */
export const CURRENT_PROJECT_VERSION = VERSION_RULES.reduce(
  (max, rule) => Math.max(max, rule.version),
  1,
);

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
