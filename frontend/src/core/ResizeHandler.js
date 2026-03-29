// src/core/ResizeHandler.js

/**
 * Registers a window resize listener that keeps the camera and renderer in sync.
 *
 * @param {THREE.PerspectiveCamera} camera
 * @param {THREE.WebGLRenderer} renderer
 */
export function setupResizeHandler(camera, renderer) {
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}
