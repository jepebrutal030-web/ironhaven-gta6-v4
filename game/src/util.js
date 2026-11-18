// Small helpers shared by every system. No dependencies.
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const TAU = Math.PI * 2;

export function dist2(ax, az, bx, bz) {
  const dx = ax - bx, dz = az - bz;
  return dx * dx + dz * dz;
}
export function dist(ax, az, bx, bz) { return Math.sqrt(dist2(ax, az, bx, bz)); }

// Angle (radians) from (ax,az) to (bx,bz), in XZ plane, y-up convention.
export function angleTo(ax, az, bx, bz) { return Math.atan2(bx - ax, bz - az); }

// Circle vs circle collision. Returns the push-out vector {x, z} for a circle
// at (ax,az) radius ar against a static circle (bx,bz) radius br, or null.
// The lateral bias keeps cars from wedging head-on against plaza trees: when
// the push is almost straight back along the travel direction, add a sideways
// component so the car slides around the obstacle instead of sticking.
export function collideCircle(ax, az, ar, bx, bz, br, tx = 0, tz = 0) {
  const dx = ax - bx, dz = az - bz;
  const rr = ar + br;
  const d2 = dx * dx + dz * dz;
  if (d2 >= rr * rr || d2 === 0) return null;
  const d = Math.sqrt(d2);
  const push = rr - d;
  const nx = dx / d, nz = dz / d;
  let px = nx * push, pz = nz * push;
  // lateral bias: if the push is nearly opposite the travel direction, the
  // circle is wedged head-on; add a sideways shove so it slides around.
  const tl = Math.hypot(tx, tz);
  if (tl > 0.01) {
    const along = (nx * tx + nz * tz) / tl;
    if (along < -0.85) {
      const side = 0.6 * push;
      const sx = -tz / tl, sz = tx / tl;
      px += sx * side; pz += sz * side;
    }
  }
  return { x: px, z: pz };
}

// Snap a value to the nearest road axis (roads are at multiples of 56).
export function nearestRoad(v) { return Math.round(v / 56) * 56; }

// Is (x,z) on a road surface? Roads run along both axes at ROADS.
export function onRoad(x, z, roads, half = 5) {
  for (const r of roads) {
    if (Math.abs(x - r) <= half || Math.abs(z - r) <= half) return true;
  }
  return false;
}
