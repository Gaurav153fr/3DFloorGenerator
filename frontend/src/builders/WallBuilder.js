// src/builders/WallBuilder.js
import * as THREE from 'three';
import { SCALE, WALL_HEIGHT, WALL_THICKNESS, MATERIALS } from '../config/constants.js';

// Reuse a single material across all walls for better performance
const wallMaterial = new THREE.MeshStandardMaterial({
  color: MATERIALS.WALL.COLOR,
  roughness: MATERIALS.WALL.ROUGHNESS,
  metalness: MATERIALS.WALL.METALNESS,
});

/**
 * Creates a 3D wall segment between two 2D points and adds it to the scene.
 *
 * @param {THREE.Scene} scene
 * @param {{ x: number, y: number }} start - 2D start point (y maps to Z axis)
 * @param {{ x: number, y: number }} end   - 2D end point
 */
export function createWall(scene, start, end) {
  const x1 = start.x * SCALE, z1 = start.y * SCALE;
  const x2 = end.x   * SCALE, z2 = end.y   * SCALE;

  const dx = x2 - x1;
  const dz = z2 - z1;
  const length = Math.sqrt(dx * dx + dz * dz);

  if (length < 0.1) return; // Skip degenerate walls

  const geo = new THREE.BoxGeometry(length, WALL_HEIGHT, WALL_THICKNESS);
  const mesh = new THREE.Mesh(geo, wallMaterial);

  mesh.position.set(x1 + dx / 2, WALL_HEIGHT / 2, z1 + dz / 2);
  mesh.rotation.y = -Math.atan2(dz, dx);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  scene.add(mesh);
}

/**
 * Builds all walls from an array of wall segment data objects.
 *
 * @param {THREE.Scene} scene
 * @param {Array<{ start: { x, y }, end: { x, y } }>} wallData
 */
export function buildWalls(scene, wallData) {
  wallData.forEach(({ start, end }) => createWall(scene, start, end));
}
