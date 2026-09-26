import { isReportable, isServiceWorkerDeployError } from '.';

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

  it('ignores errors from scripts that extensions inject', () => {
    const file = 'https://shapeshifter.design/assets/index.js';
    expect(isReportable(site, 'TypeError', file)).toBe(true);
    expect(isReportable(site, 'TypeError', 'webkit-masked-url://hidden/')).toBe(false);
    expect(isReportable(site, 'TypeError', 'chrome-extension://abc/content.js')).toBe(false);
    expect(isReportable(site, 'TypeError', 'user-script:1:2')).toBe(false);
  });
});

describe('isServiceWorkerDeployError', () => {
  it('reports service worker scripts that fail to run', () => {
    expect(
      isServiceWorkerDeployError(
        new TypeError('Failed to register a ServiceWorker: ServiceWorker script evaluation failed'),
      ),
    ).toBe(true);
  });

  it('ignores browsers that disallow service workers', () => {
    expect(isServiceWorkerDeployError(new DOMException('The operation is insecure.'))).toBe(false);
    expect(isServiceWorkerDeployError(new Error('Rejected'))).toBe(false);
    // Firefox reports failed precache downloads this way, e.g. on a flaky connection.
    expect(
      isServiceWorkerDeployError(
        new TypeError(
          'ServiceWorker script at https://x/sw.js encountered an error during installation.',
        ),
      ),
    ).toBe(false);
  });
});
