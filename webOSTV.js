/**
 * Minimal webOSTV.js stub for desktop browser testing.
 * On a real TV, package with the official webOSTV.js from LG webOS SDK / ares.
 */
(function (global) {
  'use strict';
  if (global.webOS) return;

  global.webOS = {
    platformBack: function () {
      console.info('[webOS stub] platformBack()');
      if (window.history.length > 1) window.history.back();
    },
    deviceInfo: function (cb) {
      if (typeof cb === 'function') {
        cb({ modelName: 'browser-stub', version: '0.0.0', sdkVersion: 'stub' });
      }
    },
    service: {
      request: function (uri, opts) {
        opts = opts || {};
        console.info('[webOS stub] service.request', uri, opts.method || '', opts.parameters || {});
        if (typeof opts.onFailure === 'function') {
          setTimeout(function () {
            opts.onFailure({ errorCode: -1, errorText: 'stub — not on webOS device' });
          }, 0);
        }
        return {};
      }
    },
    platform: {
      tv: false
    }
  };
})(window);
