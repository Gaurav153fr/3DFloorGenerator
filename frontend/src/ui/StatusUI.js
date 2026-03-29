// src/ui/StatusUI.js

const statusEl = document.getElementById('status');

/**
 * Updates the status text in the UI panel.
 * @param {string} message - HTML or plain text to display.
 */
export function setStatus(message) {
  if (statusEl) statusEl.innerHTML = message;
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
