// test/main.js  —  3D Floor Plan Editor: Walls · Windows · Doors
// Uses existing src/ modules + WindowBuilder + DoorBuilder

import * as THREE from 'three';
import { createScene }             from '../src/scene/SceneManager.js';
import { createRenderer }          from '../src/scene/RendererManager.js';
import { createCamera }            from '../src/scene/CameraManager.js';
import { setupLighting }           from '../src/scene/LightingManager.js';
import { createGround }            from '../src/scene/Ground.js';
import { rebuildWallWithOpenings } from '../src/builders/WallBuilder.js';
import { createWindowOnWall }      from '../src/builders/WindowBuilder.js';
import { createDoor }              from '../src/builders/DoorBuilder.js';

// ═══════════════════════════════════════════════════════════════════
//  STATE
// ═══════════════════════════════════════════════════════════════════

let walls   = [];   // { id, x1, y1, x2, y2, meshes }
let windows = [];   // { id, wallId, posT, winWidth, winHeight, sillHeight, group }
let doors   = [];   // { id, wallId, posT, doorWidth, doorHeight, door (DoorBuilder object) }
let wallIdCounter = 0;
let winIdCounter  = 0;
let doorIdCounter = 0;
let selectedWin   = null;

// ═══════════════════════════════════════════════════════════════════
//  SCENE BOOTSTRAP
// ═══════════════════════════════════════════════════════════════════

const { scene }            = createScene();
const container            = document.getElementById('canvas-container');
const { renderer }         = createRenderer(container);
const { camera, controls } = createCamera(renderer);
setupLighting(scene);
createGround(scene);

// ── Custom animation loop (allows door .update() calls each frame) ──
renderer.setAnimationLoop(() => {
  controls.update();
  doors.forEach(d => d.door.update()); // animate all door panels
  renderer.render(scene, camera);
});

// Resize renderer to canvas-container div
function resizeRenderer() {
  const w = container.clientWidth;
  const h = container.clientHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resizeRenderer);
resizeRenderer();

// ═══════════════════════════════════════════════════════════════════
//  RAYCASTER – click doors to toggle open/close
// ═══════════════════════════════════════════════════════════════════

const raycaster = new THREE.Raycaster();
const mouse     = new THREE.Vector2();

renderer.domElement.addEventListener('click', (e) => {
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((e.clientX - rect.left)  / rect.width)  * 2 - 1;
  mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);

  // Collect all door panel meshes
  const panelMeshes = doors.map(d => d.door.panelMesh);
  const hits = raycaster.intersectObjects(panelMeshes, true);

  if (hits.length > 0) {
    // Walk up to find the door panel mesh
    let hitObj = hits[0].object;
    while (hitObj.parent && !panelMeshes.includes(hitObj)) {
      hitObj = hitObj.parent;
    }
    const doorEntry = doors.find(d => d.door.panelMesh === hitObj);
    if (doorEntry) {
      doorEntry.door.toggle();
      refreshDoorList();
      const statusEl = document.getElementById('status');
      statusEl.textContent = doorEntry.door.isOpen
        ? `🚪 ${doorEntry.door.label} opened`
        : `🚪 ${doorEntry.door.label} closed`;
    }
  }
});

// ═══════════════════════════════════════════════════════════════════
//  OPENING HELPERS  (windows + doors both punch holes in walls)
// ═══════════════════════════════════════════════════════════════════

function openingsForWall(wallId) {
  const winOpenings = windows
    .filter(w => w.wallId === wallId)
    .map(w => ({
      posT: w.posT, winWidth: w.winWidth,
      winHeight: w.winHeight, sillHeight: w.sillHeight,
    }));

  const doorOpenings = doors
    .filter(d => d.wallId === wallId)
    .map(d => ({
      posT: d.posT, winWidth: d.doorWidth,
      winHeight: d.doorHeight, sillHeight: 0, // doors go to the floor
    }));

  return [...winOpenings, ...doorOpenings];
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

function addWall() {
  const x1 = parseFloat(document.getElementById('wall-x1').value);
  const y1 = parseFloat(document.getElementById('wall-y1').value);
  const x2 = parseFloat(document.getElementById('wall-x2').value);
  const y2 = parseFloat(document.getElementById('wall-y2').value);
  if ([x1, y1, x2, y2].some(isNaN)) return;

  const id   = ++wallIdCounter;
  const wall = { id, x1, y1, x2, y2, meshes: [] };
  walls.push(wall);
  wall.meshes = rebuildWallWithOpenings(scene, wall, [], []);
  refreshWallList();
  refreshWallSelect();
  updateStats();
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
  refreshWallSelect();
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

function refreshWallSelect() {
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

function addWindow() {
  const wallId     = parseInt(document.getElementById('win-wall-select').value);
  const wall       = walls.find(w => w.id === wallId);
  if (!wall) return;
  const posT       = parseFloat(document.getElementById('win-pos').value);
  const winWidth   = parseFloat(document.getElementById('win-width').value);
  const winHeight  = parseFloat(document.getElementById('win-height').value);
  const sillHeight = parseFloat(document.getElementById('win-sill').value);

  const id    = ++winIdCounter;
  const group = createWindowOnWall(scene, wall, { posT, winWidth, winHeight, sillHeight });
  windows.push({ id, wallId, posT, winWidth, winHeight, sillHeight, group });
  refreshWallGeometry(wallId);
  refreshWindowList();
  updateStats();
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
  const wd     = selectedWin;
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

function addDoor() {
  const wallId    = parseInt(document.getElementById('door-wall-select').value);
  const wall      = walls.find(w => w.id === wallId);
  if (!wall) return;
  const posT      = parseFloat(document.getElementById('door-pos').value);
  const doorWidth = parseFloat(document.getElementById('door-width').value);
  const doorHeight= parseFloat(document.getElementById('door-height').value);

  const id    = ++doorIdCounter;
  const label = `Door ${id} (W${wallId})`;
  const door  = createDoor(scene, wall, { posT, doorWidth, doorHeight, label });

  doors.push({ id, wallId, posT, doorWidth, doorHeight, door });
  refreshWallGeometry(wallId); // cut opening in wall
  refreshDoorList();
  updateStats();
}

function removeDoor(id) {
  const entry = doors.find(d => d.id === id);
  if (!entry) return;
  entry.door.dispose();
  doors = doors.filter(d => d.id !== id);
  refreshWallGeometry(entry.wallId); // heal wall
  refreshDoorList();
  updateStats();
}

function refreshDoorList() {
  const list = document.getElementById('door-list');
  list.innerHTML = '';
  doors.forEach(entry => {
    const item = document.createElement('div');
    item.className = 'list-item';
    const stateIcon = entry.door.isOpen ? '🔓' : '🔒';
    item.innerHTML = `<span>${stateIcon} ${entry.door.label} · pos=${entry.posT}</span>`;
    const del = document.createElement('button');
    del.className = 'del-btn'; del.textContent = '✕';
    del.onclick = (e) => { e.stopPropagation(); removeDoor(entry.id); };
    // Toggle on list-item click too
    item.onclick = () => {
      entry.door.toggle();
      refreshDoorList();
    };
    item.appendChild(del);
    list.appendChild(item);
  });
}

// ═══════════════════════════════════════════════════════════════════
//  STATS
// ═══════════════════════════════════════════════════════════════════

function updateStats() {
  document.getElementById('stat-walls').textContent   = walls.length;
  document.getElementById('stat-windows').textContent = windows.length;
  document.getElementById('stat-doors').textContent   = doors.length;
}

// ═══════════════════════════════════════════════════════════════════
//  WIRE BUTTONS
// ═══════════════════════════════════════════════════════════════════

document.getElementById('add-wall-btn').addEventListener('click', addWall);
document.getElementById('add-win-btn').addEventListener('click', addWindow);
document.getElementById('apply-size-btn').addEventListener('click', applyWindowChanges);
document.getElementById('delete-win-btn').addEventListener('click', () => { if (selectedWin) removeWindow(selectedWin.id); });
document.getElementById('add-door-btn').addEventListener('click', addDoor);

// ═══════════════════════════════════════════════════════════════════
//  SEED DATA  –  matches floorPlanApi.js mock layout
// ═══════════════════════════════════════════════════════════════════

// ── Walls ──
const presetWalls = [
  { x1: 0,   y1: 0,   x2: 200, y2: 0   },  // W1 – Bottom
  { x1: 200, y1: 0,   x2: 200, y2: 150 },  // W2 – Right
  { x1: 200, y1: 150, x2: 0,   y2: 150 },  // W3 – Top
  { x1: 0,   y1: 150, x2: 0,   y2: 0   },  // W4 – Left
  { x1: 100, y1: 0,   x2: 100, y2: 100 },  // W5 – Interior divider
];
presetWalls.forEach(pw => {
  document.getElementById('wall-x1').value = pw.x1;
  document.getElementById('wall-y1').value = pw.y1;
  document.getElementById('wall-x2').value = pw.x2;
  document.getElementById('wall-y2').value = pw.y2;
  addWall();
});

// ── Windows ──
const presetWindows = [
  { wallId: 1, posT: 0.25, winWidth: 14, winHeight: 7, sillHeight: 3 }, // Bottom-left
  { wallId: 1, posT: 0.75, winWidth: 14, winHeight: 7, sillHeight: 3 }, // Bottom-right
  { wallId: 2, posT: 0.4,  winWidth: 12, winHeight: 7, sillHeight: 4 }, // Right wall
  { wallId: 3, posT: 0.5,  winWidth: 16, winHeight: 8, sillHeight: 3 }, // Top wall
];
presetWindows.forEach(pw => {
  document.getElementById('win-wall-select').value = pw.wallId;
  document.getElementById('win-pos').value    = pw.posT;
  document.getElementById('win-width').value  = pw.winWidth;
  document.getElementById('win-height').value = pw.winHeight;
  document.getElementById('win-sill').value   = pw.sillHeight;
  addWindow();
});

// ── Doors  (from mock backend data – placed at natural positions) ──
// Door 1 – left exterior wall (W4) at 25% from bottom → entrance
// Door 2 – interior dividing wall (W5) at 70% → passage between rooms
const MOCK_DOOR_DATA = [
  { wallId: 4, posT: 0.25, doorWidth: 6, doorHeight: 9 }, // entrance
  { wallId: 5, posT: 0.70, doorWidth: 6, doorHeight: 9 }, // interior passage
];
MOCK_DOOR_DATA.forEach(pd => {
  document.getElementById('door-wall-select').value = pd.wallId;
  document.getElementById('door-pos').value    = pd.posT;
  document.getElementById('door-width').value  = pd.doorWidth;
  document.getElementById('door-height').value  = pd.doorHeight;
  addDoor();
});

// Reset wall inputs
document.getElementById('wall-x1').value = 0;
document.getElementById('wall-y1').value = 0;
document.getElementById('wall-x2').value = 100;
document.getElementById('wall-y2').value = 0;

document.getElementById('status').textContent =
  `✓ Ready — ${walls.length} walls · ${windows.length} windows · ${doors.length} doors · click a door to toggle`;
