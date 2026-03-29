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
  renderer.setSize(window.innerWidth, window.innerHeight);

  // Shadows
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  // Cinematic tone mapping
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  container.appendChild(renderer.domElement);

  return { renderer };
}
