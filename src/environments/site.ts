/**
 * Returns true on Shape Shifter's own site. Forks and other apps that bundle a copy of it
 * shouldn't report to its Bugsnag project or Google Analytics property, and neither should local
 * builds.
 */
export function isShapeShifterSite({
  protocol,
  hostname,
}: {
  readonly protocol: string;
  readonly hostname: string;
}) {
  return protocol === 'https:' && /(^|\.)shapeshifter\.design$/.test(hostname);
}
