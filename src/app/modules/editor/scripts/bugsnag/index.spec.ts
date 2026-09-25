import { isReportable } from '.';

describe('isReportable', () => {
  const site = { protocol: 'https:', hostname: 'shapeshifter.design' };

  it("reports errors from Shape Shifter's site", () => {
    expect(isReportable(site, 'TypeError')).toBe(true);
    expect(isReportable({ ...site, hostname: 'beta.shapeshifter.design' }, 'TypeError')).toBe(true);
  });

  it('ignores errors from other sites and apps', () => {
    expect(isReportable({ ...site, hostname: 'neoshapeshifter.web.app' }, 'TypeError')).toBe(false);
    expect(isReportable({ ...site, hostname: 'notshapeshifter.design' }, 'TypeError')).toBe(false);
    expect(isReportable({ protocol: 'http:', hostname: 'shapeshifter.design' }, 'TypeError')).toBe(
      false,
    );
    expect(isReportable({ protocol: 'file:', hostname: '' }, 'TypeError')).toBe(false);
  });

  it('ignores errors without any details', () => {
    expect(isReportable(site, 'Script error.')).toBe(false);
  });
});
