// src/core/ResizeHandler.js

/**
 * Registers a window resize listener that keeps the camera and renderer in sync.
 *
 * @param {THREE.PerspectiveCamera} camera
 * @param {THREE.WebGLRenderer} renderer
 * @param {HTMLElement} [container] - if provided, sizes to container instead of window
 */
export function setupResizeHandler(camera, renderer, container) {
  window.addEventListener('resize', () => {
    const w = container ? container.clientWidth  : window.innerWidth;
    const h = container ? container.clientHeight : window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  });
}
