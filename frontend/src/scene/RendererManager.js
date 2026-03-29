// src/scene/RendererManager.js
import * as THREE from 'three';

/**
 * Creates and configures the WebGL renderer, then mounts it to the DOM.
 * @param {HTMLElement} container - The DOM element to append the canvas to.
 * @returns {{ renderer: THREE.WebGLRenderer }}
 */
export function createRenderer(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);

  // Size to the container (not the full window) so sidebar space is respected
  const w = container.clientWidth  || window.innerWidth;
  const h = container.clientHeight || window.innerHeight;
  renderer.setSize(w, h);

  // Shadows
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  // Cinematic tone mapping
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  container.appendChild(renderer.domElement);

  return { renderer };
}
