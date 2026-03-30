// src/config/constants.js

export const SCALE = 0.2;
export const WALL_HEIGHT = 12;
export const WALL_THICKNESS = 1.2;

export const API_URL          = 'http://127.0.0.1:5000/api/data';
export const MATERIAL_API_URL = 'http://127.0.0.1:5000/api/material-analysis';
export const CHAT_API_URL     = 'http://127.0.0.1:5000/api/chat';

export const CAMERA = {
  FOV: 60,
  NEAR: 1,
  FAR: 2000,
  INITIAL_POSITION: { x: 150, y: 150, z: 150 },
};

export const SHADOWS = {
  MAP_SIZE: 2048,
  CAMERA_BOUNDS: 200, // ±200 in all directions
};

export const LIGHTS = {
  HEMI: {
    SKY_COLOR: 0xffffff,
    GROUND_COLOR: 0x444444,
    INTENSITY: 1.5,
  },
  SUN: {
    COLOR: 0xffffff,
    INTENSITY: 2,
    POSITION: { x: 100, y: 200, z: 100 },
  },
};

export const MATERIALS = {
  WALL: {
    COLOR: 0xffffff,
    ROUGHNESS: 0.4,
    METALNESS: 0.1,
  },
  GROUND: {
    COLOR: 0x1a1a1a,
    ROUGHNESS: 0.8,
  },
};
