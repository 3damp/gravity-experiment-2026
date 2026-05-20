// ── Camera ────────────────────────────────────────────────────────────────────
export const MIN_ZOOM = 0.01;
export const MAX_ZOOM = 2;

// ── Physics / gravity ─────────────────────────────────────────────────────────
/** Gravitational constant — tune this to change overall gravity strength */
export const G = 0.00005;

// ── Atmosphere ────────────────────────────────────────────────────────────────
export const AIR_FRICTION        = 0.00001;
export const AIR_DENSITY_PER_UNIT = 0.0005;
/** How strongly the atmosphere rotates the ship to align with its velocity */
export const AERO_TORQUE = 0.00002;

// ── Surface tile colliders ────────────────────────────────────────────────────
// The planet circle is a sensor; a strip of thin rectangles approximates the
// local surface and handles all ship–ground collisions.
export const TILE_COUNT          = 11;
export const TILE_ARC            = Math.PI * 0.3; // arc covered by the tile strip; centred on ship
export const TILE_THICKNESS_FRAC = 0.05;          // height = radius × this
export const TILE_NOISE_ANGLE    = 0.05;          // ± radian rotation per tile
export const TILE_NOISE_RADIAL   = 0.001;         // ± fraction-of-radius height offset
export const TILE_ACTIVATE_FRAC  = 1.2;           // activate when dist < radius × this
export const TILE_RADIAL_OFFSET  = 5;             // extra outward offset in world units

// ── Debug ─────────────────────────────────────────────────────────────────────
export const DEBUG = true; // set to true to show debug overlay
