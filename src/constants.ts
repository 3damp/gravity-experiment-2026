// ── Debug ─────────────────────────────────────────────────────────────────────
export const DEBUG = false; // set to true to show debug overlay

// ── Camera ────────────────────────────────────────────────────────────────────
export const MIN_ZOOM = 0.01;
export const MAX_ZOOM = 2;

// ── Physics / gravity ─────────────────────────────────────────────────────────
/** Gravitational constant — tune this to change overall gravity strength */
export const G = 0.00005;

// ── Atmosphere ────────────────────────────────────────────────────────────────
export const AIR_FRICTION = 0.00001;
export const AIR_DENSITY_PER_UNIT = 0.0005;
/** How strongly the atmosphere rotates the ship to align with its velocity */
export const AERO_TORQUE = 0.00002;

// ── Surface tile colliders ────────────────────────────────────────────────────
// The planet circle is a sensor; a strip of thin rectangles approximates the
// local surface and handles all ship–ground collisions.
export const TILE_COUNT = 20;
export const TILE_WIDTH = 200; // world-unit width of each tile (sets arc coverage)
export const TILE_THICKNESS_FRAC = 0.05; // height = radius × this
export const TILE_NOISE_ANGLE = 0.03; // ± radian rotation per tile
export const TILE_NOISE_RADIAL = 0.001; // ± fraction-of-radius height offset
export const TILE_ACTIVATE_FRAC = 3.0; // activate when dist < radius × this
export const TILE_RADIAL_OFFSET = 5; // extra outward offset in world units

// ── Orbiting planet ───────────────────────────────────────────────────────────
export const ORBIT_RADIUS = 24000; // distance from planet 1 centre, world units
export const ORBIT_SPEED = 0.0003; // radians per frame
