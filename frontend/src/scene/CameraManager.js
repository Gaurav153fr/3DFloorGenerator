// src/scene/CameraManager.js
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CAMERA } from '../config/constants.js';

/**
 * Creates a perspective camera with OrbitControls.
 * @param {THREE.WebGLRenderer} renderer
 * @returns {{ camera: THREE.PerspectiveCamera, controls: OrbitControls }}
 */
export function createCamera(renderer) {
  const { FOV, NEAR, FAR, INITIAL_POSITION } = CAMERA;

  const camera = new THREE.PerspectiveCamera(
    FOV,
    window.innerWidth / window.innerHeight,
    NEAR,
    FAR
  );
  camera.position.set(INITIAL_POSITION.x, INITIAL_POSITION.y, INITIAL_POSITION.z);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;

  return { camera, controls };
}
