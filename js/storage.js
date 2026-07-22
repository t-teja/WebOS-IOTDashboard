/**
 * Persistent settings via localStorage.
 * Shape: { version, dashboards[], defaultId, settings }
 */
(function (global) {
  'use strict';

  var STORAGE_KEY = 'iot-dashboard-settings-v1';
  var VERSION = 1;

  var DASHBOARD_TYPES = {
    nodered: { id: 'nodered', label: 'Node-RED', short: 'NR', color: '#ef4444' },
    grafana: { id: 'grafana', label: 'Grafana', short: 'GF', color: '#f59e0b' },
    influx: { id: 'influx', label: 'InfluxDB', short: 'IX', color: '#22d3ee' },
    homeassistant: { id: 'homeassistant', label: 'Home Assistant', short: 'HA', color: '#41bdf5' },
    custom: { id: 'custom', label: 'Custom', short: 'URL', color: '#a78bfa' }
  };

  function uid() {
    return 'd_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }

  function defaultState() {
    return {
      version: VERSION,
      dashboards: [],
      defaultId: null,
      settings: {
        cycleEnabled: false,
        cycleSeconds: 60,
        showHints: true,
        keepAwake: true
      }
    };
  }

  function normalizeUrl(url) {
    if (!url || typeof url !== 'string') return '';
    url = url.trim();
    if (!url) return '';
    if (!/^https?:\/\//i.test(url)) url = 'http://' + url;
    return url;
  }

  function isValidUrl(url) {
    try {
      var u = new URL(normalizeUrl(url));
      return u.protocol === 'http:' || u.protocol === 'https:';
    } catch (e) {
      return false;
    }
  }

  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      var data = JSON.parse(raw);
      if (!data || typeof data !== 'object') return defaultState();
      var base = defaultState();
      data.dashboards = Array.isArray(data.dashboards) ? data.dashboards : [];
      data.settings = Object.assign({}, base.settings, data.settings || {});
      data.version = VERSION;
      if (data.defaultId && !data.dashboards.some(function (d) { return d.id === data.defaultId; })) {
        data.defaultId = data.dashboards[0] ? data.dashboards[0].id : null;
      }
      return data;
    } catch (e) {
      console.warn('storage load failed', e);
      return defaultState();
    }
  }

  function save(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return state;
  }

  function getState() {
    return load();
  }

  function getDashboards() {
    return load().dashboards.slice();
  }

  function getDashboard(id) {
    return load().dashboards.find(function (d) { return d.id === id; }) || null;
  }

  function getDefaultDashboard() {
    var s = load();
    if (s.defaultId) {
      var d = s.dashboards.find(function (x) { return x.id === s.defaultId; });
      if (d) return d;
    }
    return s.dashboards[0] || null;
  }

  function addDashboard(input) {
    var s = load();
    var url = normalizeUrl(input.url);
    if (!isValidUrl(url)) throw new Error('Enter a valid http:// or https:// URL');
    var name = (input.name || '').trim() || guessName(url, input.type);
    var type = DASHBOARD_TYPES[input.type] ? input.type : 'custom';
    var item = {
      id: uid(),
      name: name,
      url: url,
      type: type,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    s.dashboards.push(item);
    if (!s.defaultId) s.defaultId = item.id;
    save(s);
    return item;
  }

  function updateDashboard(id, input) {
    var s = load();
    var idx = s.dashboards.findIndex(function (d) { return d.id === id; });
    if (idx < 0) throw new Error('Dashboard not found');
    var url = normalizeUrl(input.url);
    if (!isValidUrl(url)) throw new Error('Enter a valid http:// or https:// URL');
    var type = DASHBOARD_TYPES[input.type] ? input.type : s.dashboards[idx].type;
    s.dashboards[idx] = Object.assign({}, s.dashboards[idx], {
      name: (input.name || '').trim() || s.dashboards[idx].name,
      url: url,
      type: type,
      updatedAt: Date.now()
    });
    save(s);
    return s.dashboards[idx];
  }

  function removeDashboard(id) {
    var s = load();
    s.dashboards = s.dashboards.filter(function (d) { return d.id !== id; });
    if (s.defaultId === id) s.defaultId = s.dashboards[0] ? s.dashboards[0].id : null;
    save(s);
    return s;
  }

  function setDefault(id) {
    var s = load();
    if (!s.dashboards.some(function (d) { return d.id === id; })) {
      throw new Error('Dashboard not found');
    }
    s.defaultId = id;
    save(s);
    return s;
  }

  function updateSettings(partial) {
    var s = load();
    s.settings = Object.assign({}, s.settings, partial || {});
    var sec = parseInt(s.settings.cycleSeconds, 10);
    if (isNaN(sec) || sec < 10) sec = 10;
    if (sec > 3600) sec = 3600;
    s.settings.cycleSeconds = sec;
    s.settings.cycleEnabled = !!s.settings.cycleEnabled;
    s.settings.showHints = s.settings.showHints !== false;
    s.settings.keepAwake = s.settings.keepAwake !== false;
    save(s);
    return s.settings;
  }

  function getSettings() {
    return Object.assign({}, load().settings);
  }

  function exportJson() {
    return JSON.stringify(load(), null, 2);
  }

  function importJson(text) {
    var data = JSON.parse(text);
    if (!data || !Array.isArray(data.dashboards)) {
      throw new Error('Invalid backup file');
    }
    var base = defaultState();
    var cleaned = [];
    data.dashboards.forEach(function (d) {
      if (!d || !d.url) return;
      var url = normalizeUrl(d.url);
      if (!isValidUrl(url)) return;
      cleaned.push({
        id: d.id || uid(),
        name: (d.name || '').trim() || guessName(url, d.type),
        url: url,
        type: DASHBOARD_TYPES[d.type] ? d.type : 'custom',
        createdAt: d.createdAt || Date.now(),
        updatedAt: Date.now()
      });
    });
    base.dashboards = cleaned;
    base.defaultId = null;
    if (data.defaultId && cleaned.some(function (d) { return d.id === data.defaultId; })) {
      base.defaultId = data.defaultId;
    } else if (cleaned[0]) {
      base.defaultId = cleaned[0].id;
    }
    base.settings = Object.assign({}, base.settings, data.settings || {});
    save(base);
    return base;
  }

  function clearAll() {
    save(defaultState());
  }

  function guessName(url, type) {
    try {
      var host = new URL(normalizeUrl(url)).hostname.replace(/^www\./, '');
      var t = DASHBOARD_TYPES[type];
      return t && t.id !== 'custom' ? t.label + ' — ' + host : host;
    } catch (e) {
      return 'Dashboard';
    }
  }

  function getTypeMeta(type) {
    return DASHBOARD_TYPES[type] || DASHBOARD_TYPES.custom;
  }

  global.IOTStorage = {
    DASHBOARD_TYPES: DASHBOARD_TYPES,
    normalizeUrl: normalizeUrl,
    isValidUrl: isValidUrl,
    getState: getState,
    getDashboards: getDashboards,
    getDashboard: getDashboard,
    getDefaultDashboard: getDefaultDashboard,
    addDashboard: addDashboard,
    updateDashboard: updateDashboard,
    removeDashboard: removeDashboard,
    setDefault: setDefault,
    updateSettings: updateSettings,
    getSettings: getSettings,
    exportJson: exportJson,
    importJson: importJson,
    clearAll: clearAll,
    getTypeMeta: getTypeMeta,
    guessName: guessName
  };
})(window);
