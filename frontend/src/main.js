// src/main.js  —  Application entry point

import { createScene }          from './scene/SceneManager.js';
import { createRenderer }       from './scene/RendererManager.js';
import { createCamera }         from './scene/CameraManager.js';
import { setupLighting }        from './scene/LightingManager.js';
import { createGround }         from './scene/Ground.js';
import { buildWalls }           from './builders/WallBuilder.js';
import { fetchWallData }        from './services/floorPlanApi.js';
import { startAnimationLoop }   from './core/AnimationLoop.js';
import { setupResizeHandler }   from './core/ResizeHandler.js';
import { setStatus, setSuccess, setError } from './ui/StatusUI.js';

async function init() {
  setStatus('Initializing scene...');

  // 1. Core three.js setup
  const { scene }              = createScene();
  const { renderer }           = createRenderer(document.getElementById('canvas-container'));
  const { camera, controls }   = createCamera(renderer);

  // 2. Environment
  setupLighting(scene);
  createGround(scene);

  // 3. Start render loop immediately (shows environment before data loads)
  startAnimationLoop(renderer, scene, camera, controls);

  // 4. Responsive canvas
  setupResizeHandler(camera, renderer);

  // 5. Fetch and build walls from the API
  setStatus('Fetching floor plan data...');
  try {
    const wallData = await fetchWallData();
    buildWalls(scene, wallData);
    setSuccess(wallData.length);
  } catch (err) {
    console.error('[FloorPlan] Failed to load wall data:', err);
    setError(err.message);
  }
}

init();
