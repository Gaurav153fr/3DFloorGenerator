// src/ui/StatusUI.js

// Resolved lazily on first use so this module is safe to import
// before the DOM is fully parsed (e.g. in bundled entry points).
let _statusEl = null;
function getStatusEl() {
  if (!_statusEl) _statusEl = document.getElementById('status');
  return _statusEl;
}

/**
 * Updates the status text in the UI panel.
 * @param {string} message - HTML or plain text to display.
 */
export function setStatus(message) {
  const el = getStatusEl();
  if (el) el.innerHTML = message;
}

/**
 * Displays a success message with segment count.
 * @param {number} count
 */
export function setSuccess(count) {
  setStatus(`Environment loaded. <strong>${count}</strong> segments detected.`);
}

/**
 * Displays a connection error in the UI.
 * @param {string} [detail]
 */
export function setError(detail = '') {
  setStatus(
    `<span class="error">⚠ Connection Failed</span>${detail ? ` — ${detail}` : ''}`
  );
}
