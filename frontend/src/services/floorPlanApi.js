// src/services/floorPlanApi.js
// Real backend integration with coordinate adapter.
// Converts raw OpenCV pixel coordinates → Three.js world units.

import { API_URL, SCALE } from '../config/constants.js';

// ─── Pixel → World helpers ────────────────────────────────────────────────────

/**
 * Project a 2D point onto a line segment and return the clamped t parameter (0–1).
 * Used to compute posT for windows/doors along a wall.
 */
function projectPointOntoSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 0.0001) return 0;
  const t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  return Math.max(0, Math.min(1, t));
}

/**
 * Distance from point (px,py) to line segment (x1,y1)→(x2,y2).
 */
function distPointToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 0.0001) return Math.hypot(px - x1, py - y1);
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

/**
 * Find the wall index (0-based) closest to a given pixel coordinate midpoint.
 * Returns { wallIndex, posT } or null if no wall is close enough.
 */
function snapToNearestWall(midX, midY, walls, maxDist = 30) {
  let best = null;
  let bestDist = Infinity;

  walls.forEach((wall, idx) => {
    const { x: x1, y: y1 } = wall.start;
    const { x: x2, y: y2 } = wall.end;
    const d = distPointToSegment(midX, midY, x1, y1, x2, y2);
    if (d < bestDist) {
      bestDist = d;
      best = {
        wallIndex: idx,    // 0-based
        posT: projectPointOntoSegment(midX, midY, x1, y1, x2, y2),
      };
    }
  });

  return bestDist <= maxDist ? best : null;
}

// ─── Adapters ──────────────────────────────────────────────────────────────────

/**
 * Convert raw backend wall data → frontend wall format.
 * Backend: { walls: [{ start:{x,y}, end:{x,y}, length }] }
 * Frontend: [{ start:{x,y}, end:{x,y} }]  (same structure, just the array)
 */
function adaptWalls(data) {
  return (data.walls || []).map(w => ({
    start: { x: w.start.x, y: w.start.y },
    end: { x: w.end.x, y: w.end.y },
  }));
}

/**
 * Convert raw window pixel segments → frontend window descriptors.
 *
 * Deduplication / filtering runs in THREE steps:
 *
 *  Step 1 – Floating-window filter (pixel space):
 *    A window is "attached" to a wall only if its midpoint AND both
 *    endpoints lie within WIN_SNAP px of some wall line.
 *    Anything that fails this test is considered a false detection
 *    floating in open space and is discarded.
 *
 *  Step 2 – Normal-ray deduplication (pixel space):
 *    OpenCV often detects both inner and outer edges of the same thick
 *    wall opening as separate windows.  For every pair of windows we
 *    cast the wall-perpendicular normal ray from each centre; if the
 *    other window's centre is within NORMAL_TOL px of that ray they
 *    share the same opening.  From each such group we keep only the
 *    window whose centre is closest to a wall (most "attached").
 *
 *  Step 3 – posT edge-overlap cull (world space, safety net):
 *    After snapping to walls, adjacent windows on the same wall whose
 *    rendered edges still overlap or are < MIN_GAP world units apart
 *    are culled left → right.
 */
function adaptWindows(rawWindows, walls) {
  // ── Shared helpers ────────────────────────────────────────────────────────

  /** Minimum distance from a pixel point to the nearest wall line. */
  function minDistToAnyWall(px, py) {
    let best = Infinity;
    walls.forEach(wall => {
      const d = distPointToSegment(px, py,
        wall.start.x, wall.start.y,
        wall.end.x, wall.end.y);
      if (d < best) best = d;
    });
    return best;
  }

  // ── Step 1: Floating-window filter ───────────────────────────────────────
  // All three anchor points (start, mid, end) must be within WIN_SNAP px of
  // some wall.  If any one of them is in open space, the detection is noise.
  const WIN_SNAP = 12; // px — tightened; backend pre-filters with distance transform

  const attached = rawWindows.filter(win => {
    const sx = win.start.x, sy = win.start.y;
    const ex = win.end.x, ey = win.end.y;
    const mx = (sx + ex) / 2, my = (sy + ey) / 2;

    return (
      minDistToAnyWall(mx, my) <= WIN_SNAP &&
      minDistToAnyWall(sx, sy) <= WIN_SNAP &&
      minDistToAnyWall(ex, ey) <= WIN_SNAP
    );
  });

  // ── Step 2: Normal-ray deduplication ─────────────────────────────────────
  const NORMAL_TOL = 20; // px — two windows within this band share an opening

  /** Perpendicular distance from point (px,py) to the infinite line through
   *  (cx,cy) with unit direction (nx,ny). Uses 2-D cross-product. */
  function distToNormalRay(cx, cy, nx, ny, px, py) {
    return Math.abs(nx * (py - cy) - ny * (px - cx));
  }

  // Compute centre + unit normal for every surviving window
  const annotated = attached.map(win => {
    const cx = (win.start.x + win.end.x) / 2;
    const cy = (win.start.y + win.end.y) / 2;
    const wdx = win.end.x - win.start.x;
    const wdy = win.end.y - win.start.y;
    const wLen = Math.sqrt(wdx * wdx + wdy * wdy) || 1;
    // Unit normal = 90° rotation of the window direction → through-wall axis
    return { win, cx, cy, nx: -wdy / wLen, ny: wdx / wLen };
  });

  // Union-Find grouping: merge windows whose normal rays cross each other
  const gid = annotated.map((_, i) => i);
  const find = i => { while (gid[i] !== i) { gid[i] = gid[gid[i]]; i = gid[i]; } return i; };
  const union = (i, j) => { gid[find(j)] = find(i); };

  for (let i = 0; i < annotated.length; i++) {
    const a = annotated[i];
    for (let j = i + 1; j < annotated.length; j++) {
      const b = annotated[j];
      if (distToNormalRay(a.cx, a.cy, a.nx, a.ny, b.cx, b.cy) <= NORMAL_TOL ||
        distToNormalRay(b.cx, b.cy, b.nx, b.ny, a.cx, a.cy) <= NORMAL_TOL) {
        union(i, j);
      }
    }
  }

  // Collect groups, then pick the member closest to any wall per group
  const groups = {};
  annotated.forEach((a, i) => { (groups[find(i)] ??= []).push(a); });

  const deduped = Object.values(groups).map(group => {
    if (group.length === 1) return group[0].win;
    // Keep the window whose centre is closest to a wall
    return group.reduce((best, cur) => {
      const d = minDistToAnyWall(cur.cx, cur.cy);
      return d < minDistToAnyWall(best.cx, best.cy) ? cur : best;
    }).win;
  });

  // ── Snap to world-space walls ─────────────────────────────────────────────
  const raw = [];
  deduped.forEach(win => {
    const midX = (win.start.x + win.end.x) / 2;
    const midY = (win.start.y + win.end.y) / 2;

    const snap = snapToNearestWall(midX, midY, walls, WIN_SNAP);
    if (!snap) return; // still floating after dedup — discard

    const wall = walls[snap.wallIndex];
    const dx = wall.end.x - wall.start.x;
    const dy = wall.end.y - wall.start.y;
    const wallLenWorld = Math.sqrt(dx * dx + dy * dy) * SCALE;

    raw.push({
      wallIndex: snap.wallIndex + 1,
      posT: snap.posT,
      winWidth: Math.max(2, win.width * SCALE),
      winHeight: 7,
      sillHeight: 3,
      _wallLenWorld: wallLenWorld,
    });
  });

  // ── Step 3: posT edge-overlap cull (safety net) ───────────────────────────
  const MIN_GAP = 1; // world units

  const byWall = {};
  raw.forEach(w => { (byWall[w.wallIndex] ??= []).push(w); });

  const results = [];
  Object.values(byWall).forEach(group => {
    group.sort((a, b) => a.posT - b.posT);
    let last = null;
    for (const w of group) {
      if (!last) { results.push(w); last = w; continue; }
      const lastRight = last.posT * last._wallLenWorld + last.winWidth / 2;
      const thisLeft = w.posT * w._wallLenWorld - w.winWidth / 2;
      if (thisLeft - lastRight >= MIN_GAP) { results.push(w); last = w; }
    }
  });

  results.forEach(w => delete w._wallLenWorld);
  return results;
}

/**
 * Convert raw gate/door pixel data → frontend door descriptors.
 *
 * Backend gate: { start:{x,y}, end:{x,y}, width (px) }
 * Frontend door: { wallIndex (1-based), posT, doorWidth, doorHeight }
 *
 * doorWidth  = gate.width * SCALE
 * doorHeight = fixed 9 world units (~standard door)
 */
function adaptDoors(rawGates, walls) {
  const results = [];

  rawGates.forEach(gate => {
    const midX = (gate.start.x + gate.end.x) / 2;
    const midY = (gate.start.y + gate.end.y) / 2;

    const snap = snapToNearestWall(midX, midY, walls, 50); // doors can be further from wall center
    if (!snap) return;

    const doorWidthWorld = Math.max(3, gate.width * SCALE);

    results.push({
      wallIndex: snap.wallIndex + 1, // 1-based
      posT: snap.posT,
      doorWidth: doorWidthWorld,
      doorHeight: 9,
    });
  });

  return results;
}

// ─── State ────────────────────────────────────────────────────────────────────

/** The currently selected image file name (e.g. "F3.png"). */
let _currentImage = '';

export function setCurrentImage(name) { _currentImage = name; }
export function getCurrentImage() { return _currentImage; }

// ─── Public Fetch Functions ───────────────────────────────────────────────────

/**
 * List all available floor-plan PNGs from the backend.
 * @returns {Promise<string[]>}
 */
export async function fetchImageList() {
  try {
    const res = await fetch(API_URL.replace('/data', '/images'));
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    return json.images || [];
  } catch (e) {
    console.warn('[API] Could not fetch image list:', e.message);
    return ['F1.png', 'F2.png', 'F3.png']; // fallback labels
  }
}

/**
 * Fetch and adapt ALL floor-plan data in one round trip.
 * Returns { walls, windows, doors } ready for main.js to consume.
 *
 * @param {string} imageName  e.g. "F3.png"
 */
export async function fetchFloorPlanData(imageName) {
  const url = imageName
    ? `${API_URL}?image=${encodeURIComponent(imageName)}`
    : API_URL;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Backend returned HTTP ${res.status}`);
  const json = await res.json();
  if (json.status !== 'success') throw new Error(`API error: ${json.message}`);

  const walls = adaptWalls(json.data);
  const windows = adaptWindows(json.windows || [], walls);
  const doors = adaptDoors(json.gates || [], walls);

  return { walls, windows, doors };
}

// ─── Legacy per-resource exports (kept for backward compatibility) ─────────────
// main.js calls these; now they just delegate to fetchFloorPlanData.

let _cache = null; // cache so we make only one HTTP request per init

async function _ensureCache(imageName) {
  if (!_cache || _cache._image !== imageName) {
    _cache = await fetchFloorPlanData(imageName);
    _cache._image = imageName;
  }
  return _cache;
}

export async function fetchWallData(imageName = _currentImage) {
  const d = await _ensureCache(imageName);
  return d.walls;
}

export async function fetchWindowData(imageName = _currentImage) {
  const d = await _ensureCache(imageName);
  return d.windows;
}

export async function fetchDoorData(imageName = _currentImage) {
  const d = await _ensureCache(imageName);
  return d.doors;
}

/** Call before a fresh load to bust the cache. */
export function clearCache() { _cache = null; }
