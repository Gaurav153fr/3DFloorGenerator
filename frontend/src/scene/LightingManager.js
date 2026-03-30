// src/scene/LightingManager.js
import * as THREE from 'three';
import { LIGHTS, SHADOWS } from '../config/constants.js';

/**
 * Adds hemisphere and directional (sun) lights to the scene.
 * @param {THREE.Scene} scene
 */
export function setupLighting(scene) {
  // Hemisphere light — simulates ambient sky/ground bounce
  const hemiLight = new THREE.HemisphereLight(
    LIGHTS.HEMI.SKY_COLOR,
    LIGHTS.HEMI.GROUND_COLOR,
    LIGHTS.HEMI.INTENSITY
  );
  scene.add(hemiLight);

  // Directional "sun" light with shadow support
  const sunLight = new THREE.DirectionalLight(
    LIGHTS.SUN.COLOR,
    LIGHTS.SUN.INTENSITY
  );
  const { x, y, z } = LIGHTS.SUN.POSITION;
  sunLight.position.set(x, y, z);
  sunLight.castShadow = true;

  const b = SHADOWS.CAMERA_BOUNDS;
  sunLight.shadow.camera.left   = -b;
  sunLight.shadow.camera.right  =  b;
  sunLight.shadow.camera.top    =  b;
  sunLight.shadow.camera.bottom = -b;
  sunLight.shadow.mapSize.width  = SHADOWS.MAP_SIZE;
  sunLight.shadow.mapSize.height = SHADOWS.MAP_SIZE;

  scene.add(sunLight);
}
