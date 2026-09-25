import { isShapeShifterSite } from 'environments/site';

const MEASUREMENT_ID = 'G-0NNYX18R3S';

declare global {
  interface Window {
    dataLayer?: unknown[];
  }
}

let gtag: ((...args: unknown[]) => void) | undefined;

/**
 * Starts Google Analytics, which records a page view. Must be called once at startup. Does
 * nothing off of Shape Shifter's own site.
 */
export function startAnalytics() {
  if (!isShapeShifterSite(window.location)) {
    return;
  }
  const dataLayer = (window.dataLayer ??= []);
  gtag = function () {
    // gtag.js only handles the arguments object, not an array, so this can't use rest parameters.
    dataLayer.push(arguments);
  };
  gtag('js', new Date());
  gtag('config', MEASUREMENT_ID);
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;
  document.head.append(script);
}

/**
 * Records a user interaction as a Google Analytics event. Names may only contain letters,
 * numbers, and underscores. Parameters only show up in reports once they're registered as custom
 * dimensions in Google Analytics. Does nothing before Google Analytics has been started.
 */
export function trackEvent(name: string, params: { readonly [key: string]: string } = {}) {
  gtag?.('event', name, params);
}
