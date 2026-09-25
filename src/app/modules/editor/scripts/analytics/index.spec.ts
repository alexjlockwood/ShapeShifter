import { startAnalytics, trackEvent } from '.';

describe('analytics', () => {
  it("doesn't load Google Analytics off of Shape Shifter's site", () => {
    startAnalytics();
    trackEvent('new_file');
    expect(window.dataLayer).toBeUndefined();
    expect(document.querySelector('script[src*="googletagmanager"]')).toBeNull();
  });
});
