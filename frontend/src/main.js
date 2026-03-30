// src/main.js  —  Application entry point
// Walls · Windows (with openings) · Animated Doors · Real Backend Integration
// + Structural Intelligence Panel (Material Analysis · AI Chatbot)

import * as THREE from 'three';
import { createScene } from './scene/SceneManager.js';
import { createRenderer } from './scene/RendererManager.js';
import { createCamera } from './scene/CameraManager.js';
import { setupLighting } from './scene/LightingManager.js';
import { createGround } from './scene/Ground.js';
import { setupResizeHandler } from './core/ResizeHandler.js';
import { rebuildWallWithOpenings } from './builders/WallBuilder.js';
import { createWindowOnWall } from './builders/WindowBuilder.js';
import { createDoor } from './builders/DoorBuilder.js';
import {
  fetchWallData, fetchWindowData, fetchDoorData,
  fetchImageList, setCurrentImage, clearCache,
} from './services/floorPlanApi.js';
import { fetchMaterialAnalysis } from './services/materialApi.js';
import { setStatus, setError } from './ui/StatusUI.js';
import {
  initStructuralUI, openPanel, renderOverview,
} from './ui/StructuralPanel.js';

// Wall type colours matching the structural palette
const TYPE_COLORS = {
  load_bearing_wall: 0xff6b35,
  partition_wall:    0x00d4aa,
  slab:              0xbf5af2,
  column:            0xffd60a,
};
const DEFAULT_WALL_COLOR = 0xc8ccd8;
const SEL_COLOR    = 0xe8ff47;
const SEL_EMISSIVE = 0x3a4000;

// ═══════════════════════════════════════════════════════════════════
//  STATE
// ═══════════════════════════════════════════════════════════════════

let walls = [];  // { id, x1, y1, x2, y2, meshes: THREE.Mesh[], elData }
let windows = [];
let doors = [];
let wallIdCounter = 0;
let winIdCounter = 0;
let doorIdCounter = 0;
let selectedWin = null;
let selectedMesh = null;

/** Map: element_id → full analysis element dict */
let analysisMap = {};

// ═══════════════════════════════════════════════════════════════════
//  SCENE BOOTSTRAP
// ═══════════════════════════════════════════════════════════════════

const { scene } = createScene();
const container = document.getElementById('canvas-container');
const { renderer } = createRenderer(container);
const { camera, controls } = createCamera(renderer);

setupLighting(scene);
createGround(scene);
setupResizeHandler(camera, renderer, container);

renderer.setAnimationLoop(() => {
  controls.update();
  doors.forEach(d => d.door.update());
  renderer.render(scene, camera);
});

// ═══════════════════════════════════════════════════════════════════
//  RAYCASTER — click walls to select + open structural panel
// ═══════════════════════════════════════════════════════════════════

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let _pointerDown = { x: 0, y: 0 };

renderer.domElement.addEventListener('mousedown', (e) => {
  _pointerDown = { x: e.clientX, y: e.clientY };
});

renderer.domElement.addEventListener('mouseup', (e) => {
  // Ignore drags
  if (Math.abs(e.clientX - _pointerDown.x) > 5 || Math.abs(e.clientY - _pointerDown.y) > 5) return;

  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((e.clientX - rect.left) / rect.width)  * 2 - 1;
  mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);

  // Check wall meshes first
  const wallMeshObjects = walls.flatMap(w => w.meshes);
  const wallHits = raycaster.intersectObjects(wallMeshObjects, true);

  if (wallHits.length > 0) {
    const hitMesh = wallHits[0].object;
    const entry = walls.find(w => w.meshes.includes(hitMesh));
    if (entry) {
      _selectWall(entry);
      return;
    }
  }

  // Check door panels
  const panelMeshes = doors.map(d => d.door.panelMesh);
  const doorHits = raycaster.intersectObjects(panelMeshes, true);

  if (doorHits.length > 0) {
    let hitObj = doorHits[0].object;
    while (hitObj.parent && !panelMeshes.includes(hitObj)) hitObj = hitObj.parent;
    const entry = doors.find(d => d.door.panelMesh === hitObj);
    if (entry) {
      entry.door.toggle();
      refreshDoorList();
      setStatus(entry.door.isOpen
        ? `🚪 ${entry.door.label} — opened`
        : `🚪 ${entry.door.label} — closed`
      );
    }
  }
});

// ── Wall selection ────────────────────────────────────────────────
function _selectWall(entry) {
  // Deselect previous
  if (selectedMesh) {
    const prev = walls.find(w => w.meshes.includes(selectedMesh));
    if (prev) {
      const origColor = TYPE_COLORS[prev.elData?.element_type] ?? DEFAULT_WALL_COLOR;
      prev.meshes.forEach(m => {
        m.material.color.setHex(origColor);
        m.material.emissive?.setHex(0x000000);
      });
    }
  }
  selectedMesh = entry.meshes[0];
  entry.meshes.forEach(m => {
    m.material.color.setHex(SEL_COLOR);
    m.material.emissive?.setHex(SEL_EMISSIVE);
  });

  // Open structural panel if we have analysis data
  if (entry.elData) {
    openPanel(entry.elData);
  }
}

/** Called from overview element list clicks */
function _selectByElId(id) {
  const entry = walls.find(w => w.elData && w.elData.element_id === id);
  if (entry) {
    _selectWall(entry);
  } else {
    // Slabs/columns don't have a 3D mesh — open panel directly
    const el = analysisMap[id];
    if (el) openPanel(el);
  }
}

// ═══════════════════════════════════════════════════════════════════
//  OPENING HELPERS  (windows + doors punch holes in walls)
// ═══════════════════════════════════════════════════════════════════

function openingsForWall(wallId) {
  const winOps = windows
    .filter(w => w.wallId === wallId)
    .map(w => ({ posT: w.posT, winWidth: w.winWidth, winHeight: w.winHeight, sillHeight: w.sillHeight }));

  const doorOps = doors
    .filter(d => d.wallId === wallId)
    .map(d => ({ posT: d.posT, winWidth: d.doorWidth, winHeight: d.doorHeight, sillHeight: 0 }));

  return [...winOps, ...doorOps];
}

function refreshWallGeometry(wallId) {
  const w = walls.find(w => w.id === wallId);
  if (!w) return;
  w.meshes = rebuildWallWithOpenings(
    scene,
    { x1: w.x1, y1: w.y1, x2: w.x2, y2: w.y2 },
    w.meshes,
    openingsForWall(wallId)
  );
}

// ═══════════════════════════════════════════════════════════════════
//  WALL CRUD
// ═══════════════════════════════════════════════════════════════════

function addWall(x1, y1, x2, y2, elData = null) {
  if ([x1, y1, x2, y2].some(isNaN)) return null;
  const id = ++wallIdCounter;
  const wall = { id, x1, y1, x2, y2, meshes: [], elData };
  walls.push(wall);

  // Use structural colour if element data available
  const color = TYPE_COLORS[elData?.element_type] ?? DEFAULT_WALL_COLOR;
  wall.meshes = rebuildWallWithOpenings(scene, wall, [], [], color);

  refreshWallList();
  refreshAllSelects();
  updateStats();
  return wall;
}

function addWallFromInputs() {
  const x1 = parseFloat(document.getElementById('wall-x1').value);
  const y1 = parseFloat(document.getElementById('wall-y1').value);
  const x2 = parseFloat(document.getElementById('wall-x2').value);
  const y2 = parseFloat(document.getElementById('wall-y2').value);
  addWall(x1, y1, x2, y2);
}

function removeWall(id) {
  const w = walls.find(w => w.id === id);
  if (!w) return;
  w.meshes.forEach(m => scene.remove(m));
  walls = walls.filter(w => w.id !== id);
  windows.filter(wi => wi.wallId === id).forEach(wi => scene.remove(wi.group));
  windows = windows.filter(w => w.wallId !== id);
  doors.filter(d => d.wallId === id).forEach(d => d.door.dispose());
  doors = doors.filter(d => d.wallId !== id);
  refreshWallList();
  refreshAllSelects();
  refreshWindowList();
  refreshDoorList();
  updateStats();
}

function refreshWallList() {
  const list = document.getElementById('wall-list');
  list.innerHTML = '';
  walls.forEach(w => {
    const item = document.createElement('div');
    item.className = 'list-item';
    item.innerHTML = `<span>W${w.id} (${w.x1},${w.y1})→(${w.x2},${w.y2})</span>`;
    const del = document.createElement('button');
    del.className = 'del-btn'; del.textContent = '✕';
    del.onclick = () => removeWall(w.id);
    item.appendChild(del);
    list.appendChild(item);
  });
}

function refreshAllSelects() {
  ['win-wall-select', 'door-wall-select'].forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    sel.innerHTML = '';
    walls.forEach(w => {
      const opt = document.createElement('option');
      opt.value = w.id;
      opt.textContent = `Wall W${w.id}`;
      sel.appendChild(opt);
    });
  });
}

// ═══════════════════════════════════════════════════════════════════
//  WINDOW CRUD
// ═══════════════════════════════════════════════════════════════════

function addWindow(wallId, posT, winWidth, winHeight, sillHeight) {
  const wall = walls.find(w => w.id === wallId);
  if (!wall) return;
  const id = ++winIdCounter;
  const group = createWindowOnWall(scene, wall, { posT, winWidth, winHeight, sillHeight });
  windows.push({ id, wallId, posT, winWidth, winHeight, sillHeight, group });
  refreshWallGeometry(wallId);
  refreshWindowList();
  updateStats();
  return id;
}

function addWindowFromInputs() {
  const wallId = parseInt(document.getElementById('win-wall-select').value);
  const posT = parseFloat(document.getElementById('win-pos').value);
  const winWidth = parseFloat(document.getElementById('win-width').value);
  const winHeight = parseFloat(document.getElementById('win-height').value);
  const sillHeight = parseFloat(document.getElementById('win-sill').value);
  addWindow(wallId, posT, winWidth, winHeight, sillHeight);
}

function removeWindow(id) {
  const wd = windows.find(w => w.id === id);
  if (!wd) return;
  scene.remove(wd.group);
  windows = windows.filter(w => w.id !== id);
  refreshWallGeometry(wd.wallId);
  if (selectedWin && selectedWin.id === id) selectWindow(null);
  refreshWindowList();
  updateStats();
}

function refreshWindowList() {
  const list = document.getElementById('win-list');
  list.innerHTML = '';
  windows.forEach(wd => {
    const item = document.createElement('div');
    item.className = 'list-item' + (selectedWin && selectedWin.id === wd.id ? ' active' : '');
    item.innerHTML = `<span>Win${wd.id} · W${wd.wallId} · ${wd.winWidth}×${wd.winHeight}</span>`;
    const del = document.createElement('button');
    del.className = 'del-btn'; del.textContent = '✕';
    del.onclick = (e) => { e.stopPropagation(); removeWindow(wd.id); };
    item.onclick = () => selectWindow(wd.id);
    item.appendChild(del);
    list.appendChild(item);
  });
}

function selectWindow(id) {
  selectedWin = id === null ? null : windows.find(w => w.id === id) || null;
  const sec = document.getElementById('sel-section');
  if (!selectedWin) { sec.style.display = 'none'; refreshWindowList(); return; }
  sec.style.display = '';
  document.getElementById('sel-pos').value    = selectedWin.posT;
  document.getElementById('sel-width').value  = selectedWin.winWidth;
  document.getElementById('sel-height').value = selectedWin.winHeight;
  document.getElementById('sel-sill').value   = selectedWin.sillHeight;
  refreshWindowList();
}

function applyWindowChanges() {
  if (!selectedWin) return;
  const wd = selectedWin;
  scene.remove(wd.group);
  wd.posT       = parseFloat(document.getElementById('sel-pos').value);
  wd.winWidth   = parseFloat(document.getElementById('sel-width').value);
  wd.winHeight  = parseFloat(document.getElementById('sel-height').value);
  wd.sillHeight = parseFloat(document.getElementById('sel-sill').value);
  const wall = walls.find(w => w.id === wd.wallId);
  wd.group = createWindowOnWall(scene, wall, {
    posT: wd.posT, winWidth: wd.winWidth,
    winHeight: wd.winHeight, sillHeight: wd.sillHeight,
  });
  refreshWallGeometry(wd.wallId);
  refreshWindowList();
}

// ═══════════════════════════════════════════════════════════════════
//  DOOR CRUD
// ═══════════════════════════════════════════════════════════════════

function addDoor(wallId, posT, doorWidth, doorHeight) {
  const wall = walls.find(w => w.id === wallId);
  if (!wall) return;
  const id = ++doorIdCounter;
  const label = `Door ${id} (W${wallId})`;
  const door = createDoor(scene, wall, { posT, doorWidth, doorHeight, label });
  doors.push({ id, wallId, posT, doorWidth, doorHeight, door });
  refreshWallGeometry(wallId);
  refreshDoorList();
  updateStats();
  return id;
}

function addDoorFromInputs() {
  const wallId    = parseInt(document.getElementById('door-wall-select').value);
  const posT      = parseFloat(document.getElementById('door-pos').value);
  const doorWidth = parseFloat(document.getElementById('door-width').value);
  const doorHeight = parseFloat(document.getElementById('door-height').value);
  addDoor(wallId, posT, doorWidth, doorHeight);
}

function removeDoor(id) {
  const entry = doors.find(d => d.id === id);
  if (!entry) return;
  entry.door.dispose();
  doors = doors.filter(d => d.id !== id);
  refreshWallGeometry(entry.wallId);
  refreshDoorList();
  updateStats();
}

function refreshDoorList() {
  const list = document.getElementById('door-list');
  list.innerHTML = '';
  doors.forEach(entry => {
    const item = document.createElement('div');
    item.className = 'list-item';
    const icon = entry.door.isOpen ? '🔓' : '🔒';
    item.innerHTML = `<span>${icon} ${entry.door.label} · t=${entry.posT.toFixed(2)}</span>`;
    const del = document.createElement('button');
    del.className = 'del-btn'; del.textContent = '✕';
    del.onclick = (e) => { e.stopPropagation(); removeDoor(entry.id); };
    item.onclick = () => { entry.door.toggle(); refreshDoorList(); };
    item.appendChild(del);
    list.appendChild(item);
  });
}

// ═══════════════════════════════════════════════════════════════════
//  STATS
// ═══════════════════════════════════════════════════════════════════

function updateStats() {
  const el = document.getElementById('stat-counts');
  if (el) el.textContent = `Walls: ${walls.length}  ·  Windows: ${windows.length}  ·  Doors: ${doors.length}`;
}

// ═══════════════════════════════════════════════════════════════════
//  CLEAR SCENE
// ═══════════════════════════════════════════════════════════════════

function clearScene() {
  walls.forEach(w => w.meshes.forEach(m => scene.remove(m)));
  windows.forEach(wi => scene.remove(wi.group));
  doors.forEach(d => d.door.dispose());
  walls = []; windows = []; doors = [];
  wallIdCounter = 0; winIdCounter = 0; doorIdCounter = 0;
  selectedWin = null; selectedMesh = null; analysisMap = {};
  refreshWallList(); refreshWindowList(); refreshDoorList(); refreshAllSelects();
  updateStats();
}

// ═══════════════════════════════════════════════════════════════════
//  LOADING OVERLAY
// ═══════════════════════════════════════════════════════════════════

function showLoading(msg = 'Analysing floor plan…') {
  const overlay = document.getElementById('loading-overlay');
  const text = document.getElementById('loading-text');
  if (overlay) overlay.style.display = 'flex';
  if (text) text.textContent = msg;
}

function hideLoading() {
  const overlay = document.getElementById('loading-overlay');
  if (overlay) overlay.style.display = 'none';
}

// ═══════════════════════════════════════════════════════════════════
//  WIRE UI BUTTONS
// ═══════════════════════════════════════════════════════════════════

function wireButtons() {
  document.getElementById('add-wall-btn')?.addEventListener('click', addWallFromInputs);
  document.getElementById('add-win-btn')?.addEventListener('click', addWindowFromInputs);
  document.getElementById('apply-size-btn')?.addEventListener('click', applyWindowChanges);
  document.getElementById('delete-win-btn')?.addEventListener('click', () => { if (selectedWin) removeWindow(selectedWin.id); });
  document.getElementById('add-door-btn')?.addEventListener('click', addDoorFromInputs);

  document.getElementById('sidebar-toggle')?.addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('collapsed');
  });

  document.getElementById('load-plan-btn')?.addEventListener('click', async () => {
    const sel = document.getElementById('image-select');
    const imageName = sel ? sel.value : '';
    if (!imageName) return;
    await loadFloorPlan(imageName);
  });
}

// ═══════════════════════════════════════════════════════════════════
//  LOAD FLOOR PLAN  (fetch geometry + material analysis in parallel)
// ═══════════════════════════════════════════════════════════════════

async function loadFloorPlan(imageName) {
  showLoading(`Analysing ${imageName}…`);
  clearScene();
  clearCache();
  setCurrentImage(imageName);

  try {
    // Run both APIs in parallel
    const [geometryResult, matResult] = await Promise.allSettled([
      Promise.all([
        fetchWallData(imageName),
        fetchWindowData(imageName),
        fetchDoorData(imageName),
      ]),
      fetchMaterialAnalysis(),
    ]);

    // ── Build analysis map ──────────────────────────────────────────
    if (matResult.status === 'fulfilled') {
      matResult.value.analysis.forEach(el => { analysisMap[el.element_id] = el; });
    }

    // ── Prefer walls from material analysis (they include type info) ──
    if (matResult.status === 'fulfilled' && matResult.value.walls?.length) {
      matResult.value.walls.forEach(w => {
        const elData = analysisMap[w.element_id] || null;
        addWall(w.start.x, w.start.y, w.end.x, w.end.y, elData);
      });
    } else if (geometryResult.status === 'fulfilled') {
      // Fall back to plain wall data without classification
      geometryResult.value[0].forEach(seg => {
        addWall(seg.start.x, seg.start.y, seg.end.x, seg.end.y, null);
      });
    }

    // ── Build windows and doors ─────────────────────────────────────
    if (geometryResult.status === 'fulfilled') {
      const [, windowData, doorData] = geometryResult.value;

      windowData.forEach(w => {
        const wall = walls[w.wallIndex - 1];
        if (!wall) return;
        addWindow(wall.id, w.posT, w.winWidth, w.winHeight, w.sillHeight);
      });

      doorData.forEach(d => {
        const wall = walls[d.wallIndex - 1];
        if (!wall) return;
        addDoor(wall.id, d.posT, d.doorWidth, d.doorHeight);
      });
    }

    // ── Render overview panel ───────────────────────────────────────
    if (matResult.status === 'fulfilled') {
      renderOverview(matResult.value, _selectByElId);
    }

    const wallCount = walls.length;
    const winCount  = windows.length;
    const doorCount = doors.length;
    const matStatus = matResult.status === 'fulfilled' ? ' · Structural AI ready' : '';

    setStatus(`✓ ${imageName} · ${wallCount} walls · ${winCount} windows · ${doorCount} doors${matStatus}  |  Click a wall to inspect`);

  } catch (err) {
    console.error('[FloorPlan] Failed to load data:', err);
    setError(`Backend error: ${err.message}. Is the Flask server running on port 5000?`);
  } finally {
    hideLoading();
  }
}

// ═══════════════════════════════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════════════════════════════

async function init() {
  // Initialise structural UI panels (injects DOM, wires events)
  initStructuralUI();

  setStatus('Connecting to backend…');
  wireButtons();

  const imageSelect = document.getElementById('image-select');
  if (imageSelect) {
    try {
      const images = await fetchImageList();
      images.forEach(name => {
        const opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name.replace('.png', '');
        imageSelect.appendChild(opt);
      });
    } catch (_) {
      // fetchImageList already falls back gracefully
    }
  }

  const firstImage = imageSelect?.value || 'F3.png';
  await loadFloorPlan(firstImage);
}

init();
