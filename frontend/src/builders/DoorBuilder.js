// src/builders/DoorBuilder.js
import * as THREE from 'three';
import { SCALE, WALL_HEIGHT, WALL_THICKNESS } from '../config/constants.js';

// ─── Materials ─────────────────────────────────────────────────────────────────

const frameMat = new THREE.MeshStandardMaterial({
  color: 0x3b2510,
  roughness: 0.7,
  metalness: 0.05,
  // Render in front of wall surfaces
  polygonOffset: true,
  polygonOffsetFactor: -1,
  polygonOffsetUnits: -1,
});

const panelMat = new THREE.MeshStandardMaterial({
  color: 0x7a4e28,
  roughness: 0.55,
  metalness: 0.05,
  side: THREE.DoubleSide,
});

const insetMat = new THREE.MeshStandardMaterial({
  color: 0x5c3a1a,
  roughness: 0.65,
  metalness: 0.0,
});

const handleMat = new THREE.MeshStandardMaterial({
  color: 0xd4a843,
  roughness: 0.15,
  metalness: 0.9,
});

// ─── Door factory ─────────────────────────────────────────────────────────────

/**
 * Creates a 3D animated door on a wall segment.
 *
 * @param {THREE.Scene}  scene
 * @param {object}       wallSeg    – { x1, y1, x2, y2 } in floor-plan coords
 * @param {object}       opts
 * @param {number}       opts.posT        – 0..1 along the wall (default 0.5)
 * @param {number}       opts.doorWidth   – world units (default 6)
 * @param {number}       opts.doorHeight  – world units (default 9)
 * @param {string}       opts.label       – display name
 * @returns {{ toggle, update, panelMesh, dispose, isOpen, label }}
 */
export function createDoor(scene, wallSeg, opts = {}) {
  const {
    posT = 0.5,
    doorWidth = 6,
    doorHeight = 9,
    label = 'Door',
  } = opts;

  // ── Wall geometry in world space ──
  const x1 = wallSeg.x1 * SCALE, z1 = wallSeg.y1 * SCALE;
  const x2 = wallSeg.x2 * SCALE, z2 = wallSeg.y2 * SCALE;
  const dx = x2 - x1, dz = z2 - z1;
  const L = Math.sqrt(dx * dx + dz * dz);
  const wallAngle = Math.atan2(dz, dx); // wall runs in this direction

  // ── Hinge world position (left/start edge of door opening) ──
  const hingeDist = posT * L - doorWidth / 2;
  const cosA = Math.cos(wallAngle), sinA = Math.sin(wallAngle);
  const hx = x1 + cosA * hingeDist;
  const hz = z1 + sinA * hingeDist;

  // ── Door frame ──────────────────────────────────────────────────
  // Centred on the door opening in world space
  const frameCx = x1 + cosA * (posT * L);
  const frameCz = z1 + sinA * (posT * L);

  const frameGroup = new THREE.Group();
  frameGroup.position.set(frameCx, 0, frameCz);
  frameGroup.rotation.y = -wallAngle;

  const fw = 0.55;              // frame bar width
  // Depth is LARGER than WALL_THICKNESS so the frame protrudes through
  // both wall faces, physically removing any coplanar overlap.
  const fd = WALL_THICKNESS + 0.2;
  const halfW = doorWidth / 2;

  // [ barWidth, barHeight, offsetX, offsetY ]
  const frameBars = [
    [doorWidth + fw * 2, fw, fd, 0, doorHeight + fw / 2], // top
    [fw, doorHeight + fw, fd, -(halfW + fw / 2), doorHeight / 2],       // left upright
    [fw, doorHeight + fw, fd, (halfW + fw / 2), doorHeight / 2],       // right upright
  ];

  frameBars.forEach(([w, h, d, ox, oy]) => {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(geo, frameMat);
    mesh.position.set(ox, oy, 0);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    frameGroup.add(mesh);
  });
  scene.add(frameGroup);

  // ── Door panel (pivots at hinge) ────────────────────────────────
  // Outer wrapper aligned with the wall; inner swing wrapper rotates for open/close
  const doorRoot = new THREE.Group();
  doorRoot.position.set(hx, 0, hz);
  doorRoot.rotation.y = -wallAngle;   // hinge aligned to wall direction

  const swingPivot = new THREE.Group(); // this is what rotates for open/close
  doorRoot.add(swingPivot);

  // ── Panel body ──
  const panelW = doorWidth - fw * 0.6;
  const panelH = doorHeight - fw * 0.4;
  const panelThk = WALL_THICKNESS * 0.55;
  const panelGeo = new THREE.BoxGeometry(panelW, panelH, panelThk);
  const panel = new THREE.Mesh(panelGeo, panelMat);
  panel.position.set(panelW / 2, panelH / 2, 0);
  panel.castShadow = true;
  panel.receiveShadow = true;
  swingPivot.add(panel);

  // ── Decorative inset panels ──
  const insetW = panelW * 0.72;
  const insets = [
    { w: insetW, h: panelH * 0.30, cy: panelH * 0.28 },
    { w: insetW, h: panelH * 0.45, cy: panelH * 0.68 },
  ];
  insets.forEach(ins => {
    const geo = new THREE.BoxGeometry(ins.w, ins.h, panelThk * 0.4);
    const mesh = new THREE.Mesh(geo, insetMat);
    mesh.position.set(panelW / 2, ins.cy, panelThk * 0.3);
    swingPivot.add(mesh);
  });

  // ── Handle ──
  // Plate
  const plateMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.25, 1.6, 0.18),
    handleMat
  );
  plateMesh.position.set(panelW * 0.82, panelH * 0.45, panelThk / 2 + 0.1);
  swingPivot.add(plateMesh);

  // Lever
  const leverMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.08, 1.4, 10),
    handleMat
  );
  leverMesh.rotation.z = Math.PI / 2;
  leverMesh.position.set(panelW * 0.82 + 0.5, panelH * 0.45, panelThk / 2 + 0.22);
  swingPivot.add(leverMesh);

  scene.add(doorRoot);

  // ── Animation state ──────────────────────────────────────────────
  let isOpen = false;
  let openAmount = 0;       // lerped 0..1
  const OPEN_ANGLE = (Math.PI / 2) * 0.9; // 81° swing

  // ─── Public interface ────────────────────────────────────────────
  return {
    label,
    get isOpen() { return isOpen; },

    /** Call each frame in the render loop */
    update() {
      const target = isOpen ? 1 : 0;
      openAmount = THREE.MathUtils.lerp(openAmount, target, 0.08);
      swingPivot.rotation.y = openAmount * OPEN_ANGLE;
    },

    /** Toggle open/closed */
    toggle() { isOpen = !isOpen; },

    /** The mesh to pick with a raycaster */
    get panelMesh() { return panel; },

    /** Remove all objects from scene */
    dispose() {
      scene.remove(frameGroup);
      scene.remove(doorRoot);
    },
  };
}

/**
 * Batch-create doors from a descriptor array.
 *
 * @param {THREE.Scene} scene
 * @param {Array<{ wall: object, posT?: number, doorWidth?: number,
 *                 doorHeight?: number, label?: string }>} doorData
 */
export function buildDoors(scene, doorData) {
  return doorData.map(({ wall, ...opts }) => createDoor(scene, wall, opts));
}
