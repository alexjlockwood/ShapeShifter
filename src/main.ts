import 'hammerjs';

import { enableProdMode } from '@angular/core';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
import { EditorModule } from 'app/modules/editor/editor.module';
import { environment } from 'environments/environment';

const script = document.createElement('script');
script.innerHTML = `
(function (i, s, o, g, r, a, m) {
  i['GoogleAnalyticsObject'] = r;
  i[r] = i[r] || function () { (i[r].q = i[r].q || []).push(arguments) }, i[r].l = 1 * new Date();
  a = s.createElement(o), m = s.getElementsByTagName(o)[0];
  a.async = 1;
  a.src = g;
  m.parentNode.insertBefore(a, m)
})(window, document, 'script', 'https://www.google-analytics.com/analytics.js', 'ga');
ga('create', '${environment.analyticsTrackingId}', 'auto');
ga('send', 'pageview');
`;
document.head.appendChild(script);

if (environment.production) {
  enableProdMode();
}

platformBrowserDynamic().bootstrapModule(EditorModule);
