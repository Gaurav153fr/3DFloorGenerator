// src/scene/SceneManager.js
import * as THREE from 'three';

/**
 * Creates and configures the core Three.js scene.
 * @returns {{ scene: THREE.Scene }}
 */
export function createScene() {
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x111111, 0.002);
  return { scene };
}
