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

  // Size to the container. Use a brief rAF delay so the DOM is laid out first.
  const measure = () => {
    const w = container.clientWidth  || window.innerWidth;
    const h = container.clientHeight || (window.innerHeight - 78); // minus header+statusbar
    return { w, h };
  };
  const { w, h } = measure();
  renderer.setSize(w || window.innerWidth, h || window.innerHeight);

  // Re-size once on next paint so layout is guaranteed to be complete
  requestAnimationFrame(() => {
    const { w: w2, h: h2 } = measure();
    if (w2 > 0 && h2 > 0) renderer.setSize(w2, h2);
  });

  // Shadows
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  // Cinematic tone mapping
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  container.appendChild(renderer.domElement);

  return { renderer };
}
