// src/core/AnimationLoop.js

/**
 * Starts the render/animation loop.
 *
 * @param {THREE.WebGLRenderer} renderer
 * @param {THREE.Scene} scene
 * @param {THREE.Camera} camera
 * @param {import('three/addons/controls/OrbitControls.js').OrbitControls} controls
 */
export function startAnimationLoop(renderer, scene, camera, controls) {
  function animate() {
    requestAnimationFrame(animate);
    controls.update(); // Required for damping to work
    renderer.render(scene, camera);
  }

  animate();
}
