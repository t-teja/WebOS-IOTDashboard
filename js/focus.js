/**
 * Lightweight spatial focus helper for TV remote (arrow keys).
 * Elements marked [data-focusable] or native focusable controls participate.
 */
(function (global) {
  'use strict';

  var SELECTOR = [
    'button:not([disabled]):not(.hidden)',
    'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    'a[href]',
    '[data-focusable]:not([disabled])',
    '[tabindex]:not([tabindex="-1"])'
  ].join(',');

  function isVisible(el) {
    if (!el || el.disabled) return false;
    if (el.classList && el.classList.contains('hidden')) return false;
    var style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
    var r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }

  function getCandidates(root) {
    var scope = root || document;
    return Array.prototype.slice.call(scope.querySelectorAll(SELECTOR)).filter(isVisible);
  }

  function centerOf(el) {
    var r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, r: r };
  }

  function score(from, to, dir) {
    var a = centerOf(from);
    var b = centerOf(to);
    var dx = b.x - a.x;
    var dy = b.y - a.y;
    var primary;
    var secondary;
    var overlap;

    if (dir === 'left' || dir === 'right') {
      if (dir === 'right' && dx <= 4) return null;
      if (dir === 'left' && dx >= -4) return null;
      primary = Math.abs(dx);
      secondary = Math.abs(dy);
      overlap = Math.max(0, Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top));
    } else {
      if (dir === 'down' && dy <= 4) return null;
      if (dir === 'up' && dy >= -4) return null;
      primary = Math.abs(dy);
      secondary = Math.abs(dx);
      overlap = Math.max(0, Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left));
    }

    // Prefer overlapping targets on the cross-axis
    var bias = overlap > 0 ? -overlap * 2 : secondary * 3;
    return primary * 10 + bias + secondary;
  }

  function findInDirection(current, dir, root) {
    var list = getCandidates(root);
    if (!list.length) return null;
    if (!current || list.indexOf(current) < 0) return list[0];

    var best = null;
    var bestScore = Infinity;
    for (var i = 0; i < list.length; i++) {
      var el = list[i];
      if (el === current) continue;
      var s = score(current, el, dir);
      if (s === null) continue;
      if (s < bestScore) {
        bestScore = s;
        best = el;
      }
    }
    return best;
  }

  function focusEl(el) {
    if (!el) return;
    try {
      el.focus({ preventScroll: false });
    } catch (e) {
      el.focus();
    }
    if (typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
    }
  }

  function focusFirst(root) {
    var list = getCandidates(root);
    if (list.length) focusEl(list[0]);
    return list[0] || null;
  }

  function focusPreferred(root, preferredSelector) {
    if (preferredSelector) {
      var pref = (root || document).querySelector(preferredSelector);
      if (pref && isVisible(pref)) {
        focusEl(pref);
        return pref;
      }
    }
    return focusFirst(root);
  }

  function handleArrowKey(key, root) {
    var dir =
      key === 'ArrowLeft' ? 'left' :
      key === 'ArrowRight' ? 'right' :
      key === 'ArrowUp' ? 'up' :
      key === 'ArrowDown' ? 'down' : null;
    if (!dir) return false;

    var active = document.activeElement;
    // Let inputs handle left/right for caret movement when not at edge feels complex;
    // for TV we generally still want spatial nav — skip only for textarea vertical not needed.
    if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) {
      if ((key === 'ArrowLeft' || key === 'ArrowRight') && active.tagName === 'INPUT') {
        // allow native caret; only spatial-jump when at ends
        var start = active.selectionStart;
        var end = active.selectionEnd;
        var len = (active.value || '').length;
        if (!(start === end && ((key === 'ArrowLeft' && start === 0) || (key === 'ArrowRight' && end === len)))) {
          return false;
        }
      }
    }

    var next = findInDirection(active, dir, root);
    if (next) {
      focusEl(next);
      return true;
    }
    return false;
  }

  global.IOTFocus = {
    getCandidates: getCandidates,
    focusEl: focusEl,
    focusFirst: focusFirst,
    focusPreferred: focusPreferred,
    handleArrowKey: handleArrowKey,
    isVisible: isVisible
  };
})(window);
