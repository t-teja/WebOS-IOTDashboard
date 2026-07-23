/**
 * IOT Dashboard — main application controller
 */
(function () {
  'use strict';

  var S = window.IOTStorage;
  var F = window.IOTFocus;

  var state = {
    screen: 'configure', // configure | viewer
    currentId: null,
    overlayOpen: false,
    modalOpen: false,
    editingId: null,
    selectedType: 'custom',
    cycleTimer: null,
    cycleEndsAt: 0,
    cycleTick: null,
    hintTimer: null,
    toastTimer: null,
    keepAliveId: null
  };

  // ---------- DOM ----------
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  var el = {
    viewer: $('#screen-viewer'),
    configure: $('#screen-configure'),
    frame: $('#dashboard-frame'),
    hint: $('#viewer-hint'),
    error: $('#viewer-error'),
    errorMsg: $('#viewer-error-msg'),
    cycleBadge: $('#cycle-badge'),
    cycleBadgeText: $('#cycle-badge-text'),
    overlay: $('#overlay-menu'),
    menuList: $('#menu-list'),
    menuCycleInfo: $('#menu-cycle-info'),
    dashList: $('#dash-list'),
    dashCount: $('#dash-count'),
    cycleToggle: $('#cycle-toggle'),
    cycleSeconds: $('#cycle-seconds'),
    cycleSecondsLabel: $('#cycle-seconds-label'),
    hintsToggle: $('#hints-toggle'),
    awakeToggle: $('#awake-toggle'),
    modal: $('#modal-dashboard'),
    modalTitle: $('#modal-title'),
    modalDesc: $('#modal-desc'),
    modalError: $('#modal-error'),
    inputName: $('#input-name'),
    inputUrl: $('#input-url'),
    typeGrid: $('#type-grid'),
    confirmModal: $('#modal-confirm'),
    confirmTitle: $('#confirm-title'),
    confirmText: $('#confirm-text'),
    confirmYes: $('#btn-confirm-yes'),
    transferModal: $('#modal-transfer'),
    transferTitle: $('#transfer-title'),
    transferDesc: $('#transfer-desc'),
    transferLabel: $('#transfer-label'),
    transferText: $('#transfer-text'),
    transferError: $('#transfer-error'),
    transferCopy: $('#btn-transfer-copy'),
    transferApply: $('#btn-transfer-apply'),
    toast: $('#toast')
  };

  // SVG icons (webOS often lacks emoji glyphs)
  var ICONS = {
    plus: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
    star: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5l2.7 5.5 6 .9-4.4 4.3 1 6.1L12 17.5 6.7 20.3l1-6.1L3.3 9.9l6-.9L12 3.5z" fill="currentColor"/></svg>',
    play: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5-11-6.5z" fill="currentColor"/></svg>',
    edit: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4l10.5-10.5a1.5 1.5 0 0 0 0-2.1L16.6 5.5a1.5 1.5 0 0 0-2.1 0L4 16v4z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M13.5 6.5l4 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    close: '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>'
  };

  // ---------- Utils ----------
  function toast(msg, ms) {
    el.toast.textContent = msg;
    el.toast.classList.add('visible');
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(function () {
      el.toast.classList.remove('visible');
    }, ms || 2600);
  }

  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function typeChip(type) {
    var meta = S.getTypeMeta(type);
    return (
      '<div class="dash-type-chip" style="background:' + meta.color + '">' +
      escapeHtml(meta.short) +
      '</div>'
    );
  }

  // ---------- Screens ----------
  function showScreen(name) {
    state.screen = name;
    el.viewer.classList.toggle('active', name === 'viewer');
    el.configure.classList.toggle('active', name === 'configure');
    closeOverlay(true);
    closeModal();
    closeConfirm();
    closeTransferModal();

    if (name === 'configure') {
      stopCycle(true);
      renderConfigure();
      setTimeout(function () {
        F.focusPreferred(el.configure, '#btn-add-dashboard');
      }, 50);
    } else {
      applyKeepAwake();
      maybeStartCycle();
      showViewerHint();
      // Keep remote keys on the app shell (not trapped in the iframe)
      try { document.body.focus(); } catch (e) {}
    }
  }

  // ---------- Viewer ----------
  function openDashboard(id, opts) {
    opts = opts || {};
    var list = S.getDashboards();
    if (!list.length) {
      showScreen('configure');
      toast('Add a dashboard URL to get started');
      return;
    }
    var dash = id ? S.getDashboard(id) : S.getDefaultDashboard();
    if (!dash) dash = list[0];
    state.currentId = dash.id;

    showScreen('viewer');
    hideError();
    loadFrame(dash.url, !!opts.forceReload);
    renderOverlayList();
    if (!opts.silent) toast(dash.name, 1600);
    resetCycleDeadline();
  }

  function loadFrame(url, force) {
    // Bust cache on reload
    var src = url;
    if (force) {
      src += (url.indexOf('?') >= 0 ? '&' : '?') + '_ts=' + Date.now();
    }
    el.frame.onload = function () {
      // Cannot reliably detect X-Frame deny; onload still fires for error docs sometimes.
    };
    el.frame.onerror = function () {
      showError('Could not load this URL. Check the address and network.');
    };
    el.frame.src = src;
  }

  function reloadCurrent() {
    var d = S.getDashboard(state.currentId);
    if (!d) return;
    hideError();
    loadFrame(d.url, true);
    toast('Reloading…');
  }

  function showError(msg) {
    el.errorMsg.textContent = msg || 'This page could not be embedded.';
    el.error.classList.add('visible');
    setTimeout(function () {
      F.focusPreferred(el.error, '#btn-error-retry');
    }, 30);
  }

  function hideError() {
    el.error.classList.remove('visible');
  }

  function showViewerHint() {
    var settings = S.getSettings();
    if (!settings.showHints) return;
    el.hint.classList.add('visible');
    clearTimeout(state.hintTimer);
    state.hintTimer = setTimeout(function () {
      el.hint.classList.remove('visible');
    }, 4500);
  }

  // ---------- Overlay ----------
  function openOverlay() {
    if (state.screen !== 'viewer' || state.modalOpen) return;
    state.overlayOpen = true;
    el.overlay.classList.add('open');
    pauseCycleVisual();
    renderOverlayList();
    setTimeout(function () {
      var active = el.menuList.querySelector('.menu-item.active') || el.menuList.querySelector('.menu-item');
      if (active) F.focusEl(active);
      else F.focusPreferred(el.overlay, '#btn-menu-configure');
    }, 40);
  }

  function closeOverlay(silent) {
    if (!state.overlayOpen) return;
    state.overlayOpen = false;
    el.overlay.classList.remove('open');
    if (!silent && state.screen === 'viewer') {
      resumeCycleVisual();
      // Return focus to body so keys still work
      document.body.focus();
    }
  }

  function toggleOverlay() {
    if (state.overlayOpen) closeOverlay();
    else openOverlay();
  }

  function renderOverlayList() {
    var list = S.getDashboards();
    var settings = S.getSettings();
    var html = '';
    list.forEach(function (d) {
      var meta = S.getTypeMeta(d.type);
      var active = d.id === state.currentId;
      html +=
        '<button type="button" class="menu-item' + (active ? ' active' : '') + '" data-id="' +
        escapeHtml(d.id) + '" data-focusable>' +
        '<div class="mi-icon" style="background:' + meta.color + ';color:#0b1220">' + escapeHtml(meta.short) + '</div>' +
        '<div class="mi-body"><div class="mi-name">' + escapeHtml(d.name) + '</div>' +
        '<div class="mi-url">' + escapeHtml(d.url) + '</div></div>' +
        (active ? '<div class="mi-badge">NOW</div>' : '') +
        '</button>';
    });
    el.menuList.innerHTML = html || '<p class="menu-sub">No dashboards yet.</p>';

    if (settings.cycleEnabled && list.length > 1) {
      el.menuCycleInfo.textContent = 'Auto-cycle every ' + settings.cycleSeconds + 's';
    } else {
      el.menuCycleInfo.textContent = list.length ? list.length + ' saved' : 'Empty';
    }
  }

  // ---------- Cycle ----------
  function maybeStartCycle() {
    stopCycle(true);
    var settings = S.getSettings();
    var list = S.getDashboards();
    if (!settings.cycleEnabled || list.length < 2 || state.screen !== 'viewer') {
      el.cycleBadge.classList.remove('visible');
      return;
    }
    resetCycleDeadline();
    state.cycleTimer = setInterval(function () {
      if (state.overlayOpen || state.modalOpen || state.screen !== 'viewer') return;
      if (Date.now() < state.cycleEndsAt) return;
      cycleNext();
    }, 1000);
    state.cycleTick = setInterval(updateCycleBadge, 500);
    el.cycleBadge.classList.add('visible');
    updateCycleBadge();
  }

  function resetCycleDeadline() {
    var settings = S.getSettings();
    state.cycleEndsAt = Date.now() + settings.cycleSeconds * 1000;
    updateCycleBadge();
  }

  function stopCycle(hideBadge) {
    if (state.cycleTimer) clearInterval(state.cycleTimer);
    if (state.cycleTick) clearInterval(state.cycleTick);
    state.cycleTimer = null;
    state.cycleTick = null;
    if (hideBadge) el.cycleBadge.classList.remove('visible');
  }

  function pauseCycleVisual() {
    el.cycleBadge.classList.remove('visible');
  }

  function resumeCycleVisual() {
    var settings = S.getSettings();
    if (settings.cycleEnabled && S.getDashboards().length > 1) {
      el.cycleBadge.classList.add('visible');
      resetCycleDeadline();
    }
  }

  function updateCycleBadge() {
    var settings = S.getSettings();
    if (!settings.cycleEnabled) {
      el.cycleBadge.classList.remove('visible');
      return;
    }
    var left = Math.max(0, Math.ceil((state.cycleEndsAt - Date.now()) / 1000));
    el.cycleBadgeText.textContent = 'Next in ' + left + 's';
  }

  function cycleNext() {
    cycleBy(1);
  }

  function cycleBy(delta) {
    var list = S.getDashboards();
    if (list.length < 2) return;
    var idx = list.findIndex(function (d) { return d.id === state.currentId; });
    if (idx < 0) idx = 0;
    var next = list[(idx + delta + list.length) % list.length];
    openDashboard(next.id, { silent: false });
  }

  // ---------- Configure ----------
  function formatCycleLabel(seconds) {
    seconds = clampCycleSeconds(seconds);
    if (seconds >= 60 && seconds % 60 === 0) {
      var mins = seconds / 60;
      return mins + (mins === 1 ? ' min' : ' min');
    }
    if (seconds >= 60) {
      var m = Math.floor(seconds / 60);
      var s = seconds % 60;
      return m + 'm ' + s + 's';
    }
    return seconds + 's';
  }

  function clampCycleSeconds(seconds) {
    seconds = parseInt(seconds, 10);
    if (isNaN(seconds)) seconds = 60;
    if (seconds < 10) seconds = 10;
    if (seconds > 300) seconds = 300;
    // snap to 5s steps
    seconds = Math.round(seconds / 5) * 5;
    return seconds;
  }

  function updateCycleSliderLabel() {
    if (!el.cycleSecondsLabel) return;
    el.cycleSecondsLabel.textContent = formatCycleLabel(el.cycleSeconds.value);
  }

  function renderConfigure() {
    var list = S.getDashboards();
    var settings = S.getSettings();
    var defId = S.getState().defaultId;
    var seconds = clampCycleSeconds(settings.cycleSeconds);

    el.dashCount.textContent = list.length ? '(' + list.length + ')' : '';
    el.cycleToggle.classList.toggle('on', !!settings.cycleEnabled);
    el.cycleToggle.setAttribute('aria-pressed', settings.cycleEnabled ? 'true' : 'false');
    el.cycleSeconds.value = String(seconds);
    updateCycleSliderLabel();
    el.hintsToggle.classList.toggle('on', settings.showHints !== false);
    el.awakeToggle.classList.toggle('on', settings.keepAwake !== false);

    if (!list.length) {
      el.dashList.innerHTML =
        '<div class="empty-state">' +
        '<div class="empty-icon">' + ICONS.plus + '</div>' +
        '<h3>No dashboards yet</h3>' +
        '<p>Add Node-RED, Grafana, Influx, Home Assistant or any HTTP dashboard URL.</p>' +
        '<button type="button" class="btn btn-primary" id="btn-empty-add">' + ICONS.plus + ' Add URL</button>' +
        '</div>';
      return;
    }

    var html = '';
    list.forEach(function (d) {
      var isDef = d.id === defId;
      html +=
        '<div class="dash-card' + (isDef ? ' is-default' : '') + '" data-id="' + escapeHtml(d.id) + '">' +
        typeChip(d.type) +
        '<div class="dash-info"><div class="dash-name-row">' +
        '<div class="dash-name">' + escapeHtml(d.name) + '</div>' +
        (isDef ? '<span class="default-pill">Default</span>' : '') +
        '</div><div class="dash-url">' + escapeHtml(d.url) + '</div></div>' +
        '<div class="dash-actions">' +
        '<button type="button" class="btn-icon star' + (isDef ? ' active' : '') +
        '" data-action="default" data-id="' + escapeHtml(d.id) + '" title="Set default" aria-label="Set default">' +
        ICONS.star + '</button>' +
        '<button type="button" class="btn-icon" data-action="open" data-id="' + escapeHtml(d.id) +
        '" title="Open" aria-label="Open">' + ICONS.play + '</button>' +
        '<button type="button" class="btn-icon" data-action="edit" data-id="' + escapeHtml(d.id) +
        '" title="Edit" aria-label="Edit">' + ICONS.edit + '</button>' +
        '<button type="button" class="btn-icon danger" data-action="delete" data-id="' + escapeHtml(d.id) +
        '" title="Delete" aria-label="Delete">' + ICONS.close + '</button>' +
        '</div></div>';
    });
    el.dashList.innerHTML = html;
  }

  function saveCycleSettingsFromUI() {
    var seconds = clampCycleSeconds(el.cycleSeconds.value);
    el.cycleSeconds.value = String(seconds);
    updateCycleSliderLabel();
    S.updateSettings({
      cycleEnabled: el.cycleToggle.classList.contains('on'),
      cycleSeconds: seconds,
      showHints: el.hintsToggle.classList.contains('on'),
      keepAwake: el.awakeToggle.classList.contains('on')
    });
  }

  // ---------- Modal add/edit ----------
  function openDashboardModal(id) {
    state.modalOpen = true;
    state.editingId = id || null;
    el.modalError.classList.remove('visible');
    el.modalError.textContent = '';

    if (id) {
      var d = S.getDashboard(id);
      el.modalTitle.textContent = 'Edit dashboard';
      el.modalDesc.textContent = 'Update name, URL or type. Changes save on this TV only.';
      el.inputName.value = d ? d.name : '';
      el.inputUrl.value = d ? d.url : '';
      state.selectedType = d ? d.type : 'custom';
    } else {
      el.modalTitle.textContent = 'Add dashboard';
      el.modalDesc.textContent = 'Paste any dashboard URL. Prefer http/https on your LAN.';
      el.inputName.value = '';
      el.inputUrl.value = '';
      state.selectedType = 'custom';
    }
    renderTypeGrid();
    el.modal.classList.add('open');
    setTimeout(function () { F.focusEl(el.inputUrl); }, 40);
  }

  function closeModal() {
    if (!el.modal.classList.contains('open')) {
      state.modalOpen = false;
      return;
    }
    state.modalOpen = false;
    state.editingId = null;
    el.modal.classList.remove('open');
    if (state.screen === 'configure') {
      setTimeout(function () { F.focusPreferred(el.configure, '#btn-add-dashboard'); }, 30);
    }
  }

  function renderTypeGrid() {
    var html = '';
    Object.keys(S.DASHBOARD_TYPES).forEach(function (key) {
      var t = S.DASHBOARD_TYPES[key];
      var sel = key === state.selectedType;
      html +=
        '<button type="button" class="type-option' + (sel ? ' selected' : '') +
        '" data-type="' + key + '" data-focusable>' +
        '<span class="swatch" style="background:' + t.color + '"></span>' +
        escapeHtml(t.label) +
        '</button>';
    });
    el.typeGrid.innerHTML = html;
  }

  function submitDashboardModal() {
    var payload = {
      name: el.inputName.value,
      url: el.inputUrl.value,
      type: state.selectedType
    };
    try {
      if (state.editingId) {
        S.updateDashboard(state.editingId, payload);
        toast('Dashboard updated');
      } else {
        S.addDashboard(payload);
        toast('Dashboard added');
      }
      closeModal();
      renderConfigure();
    } catch (e) {
      el.modalError.textContent = e.message || 'Could not save';
      el.modalError.classList.add('visible');
      F.focusEl(el.inputUrl);
    }
  }

  // ---------- Confirm ----------
  var confirmCallback = null;

  function openConfirm(message, onYes, opts) {
    opts = opts || {};
    state.modalOpen = true;
    confirmCallback = onYes;
    if (el.confirmTitle) el.confirmTitle.textContent = opts.title || 'Confirm';
    el.confirmText.textContent = message;
    if (el.confirmYes) {
      el.confirmYes.textContent = opts.yesLabel || 'Delete';
      el.confirmYes.classList.toggle('btn-danger', opts.danger !== false);
      el.confirmYes.classList.toggle('btn-primary', opts.danger === false);
    }
    el.confirmModal.classList.add('open');
    setTimeout(function () {
      F.focusPreferred(el.confirmModal, opts.focusYes ? '#btn-confirm-yes' : '#btn-confirm-cancel');
    }, 40);
  }

  function closeConfirm() {
    el.confirmModal.classList.remove('open');
    confirmCallback = null;
    if (!el.modal.classList.contains('open') && !(el.transferModal && el.transferModal.classList.contains('open'))) {
      state.modalOpen = false;
    }
  }

  // ---------- Exit app (webOS home) ----------
  function exitApp() {
    try {
      if (window.webOS && typeof webOS.platformBack === 'function') {
        webOS.platformBack();
        return;
      }
    } catch (e) {}
    try {
      if (window.close) window.close();
    } catch (e2) {}
    toast('Press Home on the remote to leave the app', 3500);
  }

  function askExitApp() {
    openConfirm('Exit IOT Dashboard and return to the TV home screen?', function () {
      closeConfirm();
      exitApp();
    }, {
      title: 'Exit app',
      yesLabel: 'Exit',
      danger: true,
      focusYes: false
    });
  }

  // ---------- Import / Export (TV-friendly text modal) ----------
  var transferMode = 'export'; // export | import

  function openTransferModal(mode) {
    transferMode = mode === 'import' ? 'import' : 'export';
    state.modalOpen = true;
    el.transferError.classList.remove('visible');
    el.transferError.textContent = '';

    if (transferMode === 'export') {
      el.transferTitle.textContent = 'Export backup';
      el.transferDesc.textContent =
        'Copy this JSON and save it on your phone or PC. File download is not available on webOS TV.';
      el.transferLabel.textContent = 'Backup JSON';
      el.transferText.value = S.exportJson();
      el.transferText.readOnly = true;
      el.transferApply.classList.add('hidden');
      el.transferCopy.classList.remove('hidden');
      el.transferCopy.textContent = 'Copy';
    } else {
      el.transferTitle.textContent = 'Import backup';
      el.transferDesc.textContent =
        'Paste a previously exported JSON backup below, then choose Import. File pickers are not available on webOS TV.';
      el.transferLabel.textContent = 'Paste JSON';
      el.transferText.value = '';
      el.transferText.readOnly = false;
      el.transferApply.classList.remove('hidden');
      el.transferCopy.classList.add('hidden');
    }

    el.transferModal.classList.add('open');
    setTimeout(function () {
      F.focusEl(el.transferText);
      try {
        el.transferText.focus();
        el.transferText.select();
      } catch (e) {}
    }, 40);
  }

  function closeTransferModal() {
    if (!el.transferModal || !el.transferModal.classList.contains('open')) return;
    el.transferModal.classList.remove('open');
    if (!el.modal.classList.contains('open') && !el.confirmModal.classList.contains('open')) {
      state.modalOpen = false;
    }
    if (state.screen === 'configure') {
      setTimeout(function () { F.focusPreferred(el.configure, '#btn-add-dashboard'); }, 30);
    }
  }

  function copyTransferText() {
    var text = el.transferText.value || '';
    if (!text) {
      toast('Nothing to copy');
      return;
    }
    function ok() { toast('Copied — paste it somewhere safe'); }
    function fail() {
      try {
        el.transferText.focus();
        el.transferText.select();
      } catch (e) {}
      toast('Select-all is ready — use remote Copy if available', 3500);
    }
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(ok).catch(fail);
        return;
      }
    } catch (e1) {}
    try {
      el.transferText.focus();
      el.transferText.select();
      var success = document.execCommand && document.execCommand('copy');
      if (success) ok();
      else fail();
    } catch (e2) {
      fail();
    }
  }

  function applyTransferImport() {
    el.transferError.classList.remove('visible');
    try {
      S.importJson(String(el.transferText.value || ''));
      closeTransferModal();
      renderConfigure();
      toast('Backup restored');
    } catch (e) {
      el.transferError.textContent = e.message || 'Import failed — check the JSON';
      el.transferError.classList.add('visible');
      F.focusEl(el.transferText);
    }
  }

  // ---------- Keep awake (best-effort webOS) ----------
  function applyKeepAwake() {
    clearKeepAwake();
    var settings = S.getSettings();
    if (!settings.keepAwake) return;

    // webOS Luna service — may fail silently in browser / old firmware
    try {
      if (window.webOS && webOS.service && webOS.service.request) {
        state.keepAliveId = setInterval(function () {
          try {
            webOS.service.request('luna://com.webos.service.tvpower', {
              method: 'screen/turnOnTimeExtension',
              parameters: {},
              onSuccess: function () {},
              onFailure: function () {}
            });
          } catch (e1) {}
        }, 60000);
      }
    } catch (e) {}

    // Fallback: invisible no-op activity for some platforms
    try {
      if (navigator.wakeLock && navigator.wakeLock.request) {
        navigator.wakeLock.request('screen').then(function (lock) {
          state._wakeLock = lock;
        }).catch(function () {});
      }
    } catch (e2) {}
  }

  function clearKeepAwake() {
    if (state.keepAliveId) clearInterval(state.keepAliveId);
    state.keepAliveId = null;
    if (state._wakeLock) {
      try { state._wakeLock.release(); } catch (e) {}
      state._wakeLock = null;
    }
  }

  // ---------- Events ----------
  function onKeyDown(e) {
    var key = e.key;
    var tag = document.activeElement && document.activeElement.tagName;
    var typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

    // webOS Back — never treat Backspace as Back while typing in a field
    var isBack =
      key === 'Escape' ||
      key === 'GoBack' ||
      e.keyCode === 461 ||
      e.keyCode === 27 ||
      (key === 'Backspace' && !typing);

    if (isBack) {
      handleBack(e);
      return;
    }

    // Color / shortcut keys
    if (!typing && (key === 'm' || key === 'M' || key === 'ContextMenu')) {
      if (state.screen === 'viewer') {
        e.preventDefault();
        toggleOverlay();
        return;
      }
    }

    // Enter / OK — while viewing with no chrome open, open the menu
    // (cross-origin iframes swallow keys once focused; keep focus on app chrome)
    if (!typing && (key === 'Enter' || key === ' ' || e.keyCode === 13 || e.keyCode === 32)) {
      if (
        state.screen === 'viewer' &&
        !state.overlayOpen &&
        !state.modalOpen &&
        !el.error.classList.contains('visible') &&
        (!document.activeElement ||
          document.activeElement === document.body ||
          document.activeElement === el.frame ||
          document.activeElement === document.documentElement)
      ) {
        e.preventDefault();
        openOverlay();
        return;
      }
    }

    if (key === 'ArrowUp' || key === 'ArrowDown' || key === 'ArrowLeft' || key === 'ArrowRight') {
      var root = null;
      if (el.confirmModal.classList.contains('open')) root = el.confirmModal;
      else if (el.transferModal && el.transferModal.classList.contains('open')) root = el.transferModal;
      else if (el.modal.classList.contains('open')) root = el.modal;
      else if (state.overlayOpen) root = el.overlay;
      else if (state.screen === 'configure') root = el.configure;
      else if (el.error.classList.contains('visible')) root = el.error;
      else if (state.screen === 'viewer' && !state.overlayOpen) {
        // Cross-origin iframes cannot take our D-pad; Magic Remote pointer still works inside them.
        // Left/Right: previous/next dashboard. Up/Down: open the menu.
        e.preventDefault();
        if (key === 'ArrowLeft') {
          cycleBy(-1);
          return;
        }
        if (key === 'ArrowRight') {
          cycleBy(1);
          return;
        }
        openOverlay();
        return;
      }
      if (root && F.handleArrowKey(key, root)) {
        e.preventDefault();
        e.stopPropagation();
      }
    }
  }

  function handleBack(e) {
    if (el.confirmModal.classList.contains('open')) {
      e.preventDefault();
      closeConfirm();
      return;
    }
    if (el.transferModal && el.transferModal.classList.contains('open')) {
      e.preventDefault();
      closeTransferModal();
      return;
    }
    if (el.modal.classList.contains('open')) {
      e.preventDefault();
      closeModal();
      return;
    }
    if (state.overlayOpen) {
      e.preventDefault();
      closeOverlay();
      return;
    }
    if (state.screen === 'configure') {
      e.preventDefault();
      var list = S.getDashboards();
      // Prefer returning to the viewer when dashboards exist (hierarchical Back).
      // On an empty setup, or from Exit controls, ask to leave the app.
      if (list.length) {
        var target = state.currentId
          ? S.getDashboard(state.currentId)
          : S.getDefaultDashboard();
        openDashboard(target ? target.id : list[0].id, { silent: true });
        return;
      }
      askExitApp();
      return;
    }
    if (state.screen === 'viewer') {
      e.preventDefault();
      // First Back opens menu; menu has Configure + Exit app
      openOverlay();
    }
  }

  function bind() {
    document.addEventListener('keydown', onKeyDown, true);

    // Configure header
    $('#btn-add-dashboard').addEventListener('click', function () { openDashboardModal(null); });
    $('#btn-open-viewer').addEventListener('click', function () {
      var d = S.getDefaultDashboard();
      if (!d) { toast('Add a dashboard first'); return; }
      openDashboard(d.id);
    });
    $('#btn-export').addEventListener('click', function () { openTransferModal('export'); });
    $('#btn-import').addEventListener('click', function () { openTransferModal('import'); });
    var exitBtn = $('#btn-exit-app');
    if (exitBtn) exitBtn.addEventListener('click', askExitApp);

    el.dashList.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-action]');
      if (!btn) {
        var emptyAdd = e.target.closest('#btn-empty-add');
        if (emptyAdd) openDashboardModal(null);
        return;
      }
      var id = btn.getAttribute('data-id');
      var action = btn.getAttribute('data-action');
      if (action === 'open') openDashboard(id);
      else if (action === 'edit') openDashboardModal(id);
      else if (action === 'default') {
        S.setDefault(id);
        renderConfigure();
        toast('Default dashboard set');
      } else if (action === 'delete') {
        var d = S.getDashboard(id);
        openConfirm('Remove “' + (d ? d.name : 'dashboard') + '”? This cannot be undone.', function () {
          S.removeDashboard(id);
          closeConfirm();
          renderConfigure();
          toast('Removed');
        }, { title: 'Delete dashboard', yesLabel: 'Delete', danger: true });
      }
    });

    // Settings toggles
    el.cycleToggle.addEventListener('click', function () {
      el.cycleToggle.classList.toggle('on');
      saveCycleSettingsFromUI();
      toast(el.cycleToggle.classList.contains('on') ? 'Auto-cycle on' : 'Auto-cycle off');
    });
    el.hintsToggle.addEventListener('click', function () {
      el.hintsToggle.classList.toggle('on');
      saveCycleSettingsFromUI();
    });
    el.awakeToggle.addEventListener('click', function () {
      el.awakeToggle.classList.toggle('on');
      saveCycleSettingsFromUI();
    });
    el.cycleSeconds.addEventListener('input', function () {
      updateCycleSliderLabel();
    });
    el.cycleSeconds.addEventListener('change', function () {
      saveCycleSettingsFromUI();
      toast('Interval: ' + formatCycleLabel(el.cycleSeconds.value));
    });

    // Modal
    $('#btn-modal-cancel').addEventListener('click', closeModal);
    $('#btn-modal-save').addEventListener('click', submitDashboardModal);
    el.modal.addEventListener('click', function (e) {
      if (e.target === el.modal) closeModal();
    });
    el.typeGrid.addEventListener('click', function (e) {
      var opt = e.target.closest('[data-type]');
      if (!opt) return;
      state.selectedType = opt.getAttribute('data-type');
      renderTypeGrid();
    });
    el.inputUrl.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); submitDashboardModal(); }
    });
    el.inputName.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); submitDashboardModal(); }
    });

    // Confirm
    $('#btn-confirm-cancel').addEventListener('click', closeConfirm);
    $('#btn-confirm-yes').addEventListener('click', function () {
      if (typeof confirmCallback === 'function') confirmCallback();
    });
    el.confirmModal.addEventListener('click', function (e) {
      if (e.target === el.confirmModal) closeConfirm();
    });

    // Transfer (import/export)
    $('#btn-transfer-cancel').addEventListener('click', closeTransferModal);
    el.transferCopy.addEventListener('click', copyTransferText);
    el.transferApply.addEventListener('click', applyTransferImport);
    el.transferModal.addEventListener('click', function (e) {
      if (e.target === el.transferModal) closeTransferModal();
    });

    // Overlay
    el.overlay.addEventListener('click', function (e) {
      if (e.target === el.overlay) closeOverlay();
    });
    el.menuList.addEventListener('click', function (e) {
      var item = e.target.closest('.menu-item[data-id]');
      if (!item) return;
      var id = item.getAttribute('data-id');
      closeOverlay(true);
      openDashboard(id);
    });
    $('#btn-menu-configure').addEventListener('click', function () {
      showScreen('configure');
    });
    $('#btn-menu-reload').addEventListener('click', function () {
      closeOverlay();
      reloadCurrent();
    });
    $('#btn-menu-close').addEventListener('click', function () { closeOverlay(); });
    var menuExit = $('#btn-menu-exit');
    if (menuExit) menuExit.addEventListener('click', askExitApp);

    // Error actions
    $('#btn-error-retry').addEventListener('click', reloadCurrent);
    $('#btn-error-menu').addEventListener('click', openOverlay);
    $('#btn-error-config').addEventListener('click', function () { showScreen('configure'); });

    // Top hit-zone (Magic Remote) — sits above the iframe
    var hotzone = $('#menu-hotzone');
    if (hotzone) {
      hotzone.addEventListener('click', function (e) {
        e.preventDefault();
        openOverlay();
      });
    }

    // Keep D-pad keys on the app shell: blur iframe if it steals focus
    el.frame.addEventListener('focus', function () {
      try { document.body.focus(); } catch (err) {}
    });
    el.frame.setAttribute('tabindex', '-1');
  }

  function boot() {
    bind();
    document.body.setAttribute('tabindex', '-1');

    var list = S.getDashboards();
    var def = S.getDefaultDashboard();
    if (def) {
      openDashboard(def.id, { silent: true });
    } else {
      showScreen('configure');
      toast('Welcome — add your first dashboard URL', 3500);
    }

    // webOS visibility
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        stopCycle(false);
        clearKeepAwake();
      } else if (state.screen === 'viewer') {
        maybeStartCycle();
        applyKeepAwake();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
