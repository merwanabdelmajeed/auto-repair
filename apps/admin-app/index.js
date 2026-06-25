// Patch URL.protocol for React Native 0.76 new architecture (Bridgeless / Hermes).
// This must run before any require() so that React Navigation and expo-linking
// never see the unimplemented getter.
(function patchURL() {
  if (typeof URL === 'undefined' || !URL.prototype) return;
  const desc = Object.getOwnPropertyDescriptor(URL.prototype, 'protocol');
  if (desc && typeof desc.get === 'function') return; // already works — nothing to do

  function getHref(instance) {
    try { return instance.href || ''; } catch (_) { return ''; }
  }

  Object.defineProperty(URL.prototype, 'protocol', {
    get: function () {
      const href = getHref(this);
      const i = href.indexOf(':');
      return i >= 0 ? href.slice(0, i + 1) : '';
    },
    configurable: true,
    enumerable: true,
  });

  Object.defineProperty(URL.prototype, 'host', {
    get: function () {
      const href = getHref(this);
      const m = href.match(/^[a-z][a-z0-9+.-]*:\/\/([^/?#]*)/i);
      return m ? m[1] : '';
    },
    configurable: true,
    enumerable: true,
  });

  Object.defineProperty(URL.prototype, 'hostname', {
    get: function () {
      const host = this.host;
      return host.split(':')[0] || '';
    },
    configurable: true,
    enumerable: true,
  });

  Object.defineProperty(URL.prototype, 'pathname', {
    get: function () {
      const href = getHref(this);
      const m = href.match(/^[a-z][a-z0-9+.-]*:\/\/[^/?#]*([^?#]*)/i);
      return (m && m[1]) ? m[1] : '/';
    },
    configurable: true,
    enumerable: true,
  });

  Object.defineProperty(URL.prototype, 'search', {
    get: function () {
      const href = getHref(this);
      const m = href.match(/\?([^#]*)/);
      return m ? '?' + m[1] : '';
    },
    configurable: true,
    enumerable: true,
  });

  Object.defineProperty(URL.prototype, 'hash', {
    get: function () {
      const href = getHref(this);
      const m = href.match(/#(.*)/);
      return m ? '#' + m[1] : '';
    },
    configurable: true,
    enumerable: true,
  });
})();

// Register the app — replaces the default expo AppEntry.
const { registerRootComponent } = require('expo');
const App = require('./App').default;
registerRootComponent(App);
