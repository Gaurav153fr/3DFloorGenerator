// src/services/materialApi.js
// All API calls related to Material Analysis and Gemini AI Chat.
// Extracted from 3DFloorGenerator/frontend/index.html

import { MATERIAL_API_URL, CHAT_API_URL } from '../config/constants.js';

/**
 * Fetch material analysis from the backend.
 * Returns the full JSON:
 * {
 *   status: 'success',
 *   summary: { total_elements, load_bearing_walls, partition_walls, slabs, columns },
 *   analysis: [ { element_id, element_type, room_label, span_m, area_m2,
 *                 is_outer, is_spine, recommendations, concerns,
 *                 weight_profile, start, end, length_px, prompt_text } ],
 *   walls: [ { element_id, element_type, start, end, span_m, is_outer, is_spine } ]
 * }
 * @returns {Promise<Object>}
 */
export async function fetchMaterialAnalysis() {
  const res = await fetch(MATERIAL_API_URL);
  if (!res.ok) throw new Error(`Material API HTTP ${res.status}`);
  const json = await res.json();
  if (json.status !== 'success') throw new Error(`Material API error: ${json.message}`);
  return json;
}

/**
 * Send a chat question about a structural element to Gemini.
 * @param {string} question  The user's question text
 * @param {Object} element   The full element dict from analysis
 * @returns {Promise<string>} The AI answer text
 */
export async function sendChatMessage(question, element) {
  const res = await fetch(CHAT_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, element }),
  });
  if (!res.ok) throw new Error(`Chat API HTTP ${res.status}`);
  const data = await res.json();
  return data.answer || 'No response from AI.';
}
