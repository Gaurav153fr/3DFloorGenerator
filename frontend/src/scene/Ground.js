// src/scene/Ground.js
import * as THREE from 'three';
import { MATERIALS } from '../config/constants.js';

/**
 * Adds a large shadow-receiving ground plane to the scene.
 * @param {THREE.Scene} scene
 */
export function createGround(scene) {
  const geo = new THREE.PlaneGeometry(1000, 1000);
  const mat = new THREE.MeshStandardMaterial({
    color: MATERIALS.GROUND.COLOR,
    roughness: MATERIALS.GROUND.ROUGHNESS,
  });

  const ground = new THREE.Mesh(geo, mat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;

  scene.add(ground);
}
