// src/services/floorPlanApi.js
import { API_URL } from '../config/constants.js';

// ─── Mock Data ────────────────────────────────────────────────────────────────
// A simple floor plan: outer walls + one interior dividing wall + a room pocket
const MOCK_DATA = [
  // Outer walls (rectangle 200 x 150)
  { start: { x: 0,   y: 0   }, end: { x: 200, y: 0   } }, // Bottom
  { start: { x: 200, y: 0   }, end: { x: 200, y: 150 } }, // Right
  { start: { x: 200, y: 150 }, end: { x: 0,   y: 150 } }, // Top
  { start: { x: 0,   y: 150 }, end: { x: 0,   y: 0   } }, // Left

  // Interior wall — splits the space into two rooms
  { start: { x: 100, y: 0   }, end: { x: 100, y: 100 } },

  // Small pocket / alcove on the right room
  { start: { x: 150, y: 60  }, end: { x: 200, y: 60  } },
  { start: { x: 150, y: 60  }, end: { x: 150, y: 100 } },
  { start: { x: 150, y: 100 }, end: { x: 200, y: 100 } },
];

// ─── Toggle ───────────────────────────────────────────────────────────────────
// ✅ Set to false when your real Flask backend is running
const USE_MOCK = true;

// ─── API Function ─────────────────────────────────────────────────────────────
/**
 * Fetches wall segment data.
 * Returns MOCK_DATA when USE_MOCK is true, otherwise hits the real API.
 *
 * @returns {Promise<Array<{ start: { x, y }, end: { x, y } }>>}
 * @throws {Error} if the real fetch fails or returns an unexpected status
 */
export async function fetchWallData() {
  if (USE_MOCK) {
    // Simulate a small network delay so loading states are visible
    await new Promise((res) => setTimeout(res, 300));
    return MOCK_DATA;
  }

  const response = await fetch(API_URL);
  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);

  const result = await response.json();
  if (result.status !== 'success') throw new Error(`API error: "${result.status}"`);

  return result.data;
}
