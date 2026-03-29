// src/services/floorPlanApi.js
import { API_URL } from '../config/constants.js';

// ─── Mock Wall Data ────────────────────────────────────────────────────────────
// Outer walls (rectangle 200 x 150) + interior divider + alcove
const MOCK_WALLS = [
  { start: { x: 0,   y: 0   }, end: { x: 200, y: 0   } }, // W1 – Bottom
  { start: { x: 200, y: 0   }, end: { x: 200, y: 150 } }, // W2 – Right
  { start: { x: 200, y: 150 }, end: { x: 0,   y: 150 } }, // W3 – Top
  { start: { x: 0,   y: 150 }, end: { x: 0,   y: 0   } }, // W4 – Left
  { start: { x: 100, y: 0   }, end: { x: 100, y: 100 } }, // W5 – Interior divider
  { start: { x: 150, y: 60  }, end: { x: 200, y: 60  } }, // W6 – Alcove top
  { start: { x: 150, y: 60  }, end: { x: 150, y: 100 } }, // W7 – Alcove left
  { start: { x: 150, y: 100 }, end: { x: 200, y: 100 } }, // W8 – Alcove bottom
];

// ─── Mock Window Data ─────────────────────────────────────────────────────────
// wallIndex is 1-based, matching the order in MOCK_WALLS above.
// positions are posT (0-1 along that wall), winWidth/winHeight in world units, sillHeight from floor.
const MOCK_WINDOWS = [
  { wallIndex: 1, posT: 0.25, winWidth: 14, winHeight: 7, sillHeight: 3 }, // Bottom-left window
  { wallIndex: 1, posT: 0.75, winWidth: 14, winHeight: 7, sillHeight: 3 }, // Bottom-right window
  { wallIndex: 2, posT: 0.40, winWidth: 12, winHeight: 7, sillHeight: 4 }, // Right-wall window
  { wallIndex: 3, posT: 0.50, winWidth: 16, winHeight: 8, sillHeight: 3 }, // Top-wall window
];

// ─── Mock Door Data ───────────────────────────────────────────────────────────
// wallIndex is 1-based; posT 0-1 along that wall; doorWidth/doorHeight in world units.
const MOCK_DOORS = [
  { wallIndex: 4, posT: 0.25, doorWidth: 6, doorHeight: 9 }, // Entrance on left wall
  { wallIndex: 5, posT: 0.70, doorWidth: 6, doorHeight: 9 }, // Interior passage on divider
];

// ─── Toggle ───────────────────────────────────────────────────────────────────
// Set to false when your real Flask backend is running
const USE_MOCK = true;

// ─── Fetch Functions ──────────────────────────────────────────────────────────

/**
 * Fetches wall segment data.
 * Returns MOCK_WALLS when USE_MOCK is true.
 *
 * @returns {Promise<Array<{ start: { x, y }, end: { x, y } }>>}
 */
export async function fetchWallData() {
  if (USE_MOCK) {
    await new Promise(res => setTimeout(res, 300));
    return MOCK_WALLS;
  }
  const response = await fetch(API_URL);
  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
  const result = await response.json();
  if (result.status !== 'success') throw new Error(`API error: "${result.status}"`);
  return result.data;
}

/**
 * Fetches window data for each wall (indexed to the walls array).
 *
 * @returns {Promise<Array<{ wallIndex, posT, winWidth, winHeight, sillHeight }>>}
 */
export async function fetchWindowData() {
  if (USE_MOCK) {
    await new Promise(res => setTimeout(res, 100));
    return MOCK_WINDOWS;
  }
  // Real implementation: fetch from /api/windows
  const response = await fetch(API_URL.replace('/data', '/windows'));
  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
  const result = await response.json();
  return result.data;
}

/**
 * Fetches door data for each wall (indexed to the walls array).
 *
 * @returns {Promise<Array<{ wallIndex, posT, doorWidth, doorHeight }>>}
 */
export async function fetchDoorData() {
  if (USE_MOCK) {
    await new Promise(res => setTimeout(res, 100));
    return MOCK_DOORS;
  }
  // Real implementation: fetch from /api/doors
  const response = await fetch(API_URL.replace('/data', '/doors'));
  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
  const result = await response.json();
  return result.data;
}
