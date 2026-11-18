// The city of Ironhaven: ~392x392 m, 7x7 blocks, three districts (downtown
// towers at the center, residential west/south, harbor + sea east). All
// procedural: the ground (roads, markings, sidewalks, plaza) is one big
// canvas texture; buildings get canvas facade textures (window grids,
// brick, glass). Trees sit >=10 m off every road axis.
import * as THREE from 'three';
import { CITY_HALF, ROADS, ROAD_WIDTH, PLAZA, SEA_X, WAREHOUSE } from './config.js';
import { dist2 } from './util.js';

export { dist2 };

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// ---- facade textures ----
function windowTex(base, win, lit) {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    const cols = 8, rows = 12, cw = w / cols, rh = h / rows;
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const isLit = ((x * 7 + y * 13) % 5) === 0;
      g.fillStyle = isLit ? lit : win;
      g.fillRect(x * cw + 4, y * rh + 4, cw - 8, rh - 8);
    }
  });
}
function brickTex() {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#8a4a34'; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(0,0,0,0.18)';
    for (let y = 0; y < 16; y++) for (let x = 0; x < 8; x++) {
      g.fillRect(x * 32 + (y % 2 ? 16 : 0), y * 16, 30, 2);
      g.fillRect(x * 32 + (y % 2 ? 16 : 0), y * 16, 2, 14);
    }
    g.fillStyle = 'rgba(255,255,255,0.08)';
    for (let i = 0; i < 40; i++) g.fillRect(Math.random() * w, Math.random() * h, 20, 8);
  });
}
function glassTex() {
  return canvasTex(256, 256, (g, w, h) => {
    const grad = g.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#7fb2d9'); grad.addColorStop(0.5, '#4a7ba6'); grad.addColorStop(1, '#2e5a7a');
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,0.25)';
    for (let y = 0; y < 10; y++) g.fillRect(0, y * 26 + 4, w, 3);
    g.fillStyle = 'rgba(255,255,255,0.12)';
    g.fillRect(30, 0, 40, h); g.fillRect(150, 0, 24, h);
  });
}

// ---- ground texture: roads, lane markings, sidewalks, plaza, grass ----
function groundTexture() {
  const S = 2048, half = CITY_HALF;
  const toPx = (v) => ((v + half) / (half * 2)) * S;
  return canvasTex(S, S, (g) => {
    g.fillStyle = '#6a8a52'; g.fillRect(0, 0, S, S); // grass base (brightened)
    // block sidewalks (light concrete) inside each block
    g.fillStyle = '#9a9a92';
    for (const rx of ROADS) for (const rz of ROADS) {
      // each block is the square between four roads; draw sidewalk pads
    }
    for (let i = 0; i < ROADS.length - 1; i++) for (let j = 0; j < ROADS.length - 1; j++) {
      const x0 = toPx(ROADS[i] + ROAD_WIDTH / 2), x1 = toPx(ROADS[i + 1] - ROAD_WIDTH / 2);
      const z0 = toPx(ROADS[j] + ROAD_WIDTH / 2), z1 = toPx(ROADS[j + 1] - ROAD_WIDTH / 2);
      g.fillStyle = '#a3a39b';
      g.fillRect(x0, z0, x1 - x0, z1 - z0);
    }
    // roads (asphalt, brightened so shadowed roads stay readable)
    g.fillStyle = '#45484e';
    for (const r of ROADS) {
      g.fillRect(toPx(r - ROAD_WIDTH / 2), 0, toPx(ROAD_WIDTH) - toPx(0) + (toPx(ROAD_WIDTH / 2) - toPx(-ROAD_WIDTH / 2)), S);
      g.fillRect(0, toPx(r - ROAD_WIDTH / 2), S, toPx(ROAD_WIDTH) - toPx(0) + (toPx(ROAD_WIDTH / 2) - toPx(-ROAD_WIDTH / 2)));
    }
    // lane dashes (center lines)
    g.fillStyle = '#d8c33a';
    for (const r of ROADS) {
      for (let v = -CITY_HALF; v < CITY_HALF; v += 12) {
        g.fillRect(toPx(r) - 2, toPx(v), 4, 18);
        g.fillRect(toPx(v), toPx(r) - 2, 18, 4);
      }
    }
    // crosswalks at intersections
    g.fillStyle = 'rgba(255,255,255,0.75)';
    for (const rx of ROADS) for (const rz of ROADS) {
      for (let k = -2; k <= 2; k++) {
        g.fillRect(toPx(rx + k * 2) - 3, toPx(rz - ROAD_WIDTH / 2) - 2, 6, 4);
        g.fillRect(toPx(rx + k * 2) - 3, toPx(rz + ROAD_WIDTH / 2) - 2, 6, 4);
      }
    }
    // Founders Plaza (warm stone, center)
    g.fillStyle = '#b09a72';
    g.beginPath(); g.arc(toPx(PLAZA.x), toPx(PLAZA.z), (PLAZA.r / (CITY_HALF * 2)) * S, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#8a7550'; g.lineWidth = 6;
    g.beginPath(); g.arc(toPx(PLAZA.x), toPx(PLAZA.z), (PLAZA.r / (CITY_HALF * 2)) * S, 0, Math.PI * 2); g.stroke();
    // harbor apron (east edge, concrete)
    g.fillStyle = '#7e7a72';
    g.fillRect(toPx(120), toPx(-40), toPx(CITY_HALF) - toPx(120), toPx(40) - toPx(-40));
  });
}

export function buildWorld(scene, rng) {
  const group = new THREE.Group();
  scene.add(group);

  // ---- lights: sun (shadow-casting) + bright hemisphere + ambient ----
  const sun = new THREE.DirectionalLight(0xfff2dd, 2.6);
  sun.position.set(120, 180, 60);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -220; sun.shadow.camera.right = 220;
  sun.shadow.camera.top = 220; sun.shadow.camera.bottom = -220;
  sun.shadow.camera.far = 600;
  sun.shadow.bias = -0.0004;
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0xbfd9ff, 0x8a7a5a, 1.05));
  scene.add(new THREE.AmbientLight(0xffffff, 0.35));

  // ---- ground ----
  const groundMat = new THREE.MeshStandardMaterial({ map: groundTexture(), roughness: 0.95, metalness: 0 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(CITY_HALF * 2, CITY_HALF * 2), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  // ---- sea (east) ----
  const seaMat = new THREE.MeshStandardMaterial({ color: 0x1e6f9e, roughness: 0.25, metalness: 0.35 });
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(220, CITY_HALF * 2 + 40), seaMat);
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(SEA_X + 110, -0.4, 0);
  sea.receiveShadow = true;
  group.add(sea);
  // docks
  const dockMat = new THREE.MeshStandardMaterial({ color: 0x6b5d4f, roughness: 0.9 });
  for (const dz of [-60, 0, 60]) {
    const dock = new THREE.Mesh(new THREE.BoxGeometry(26, 1.2, 10), dockMat);
    dock.position.set(SEA_X + 6, 0.2, dz);
    dock.castShadow = true; dock.receiveShadow = true;
    group.add(dock);
  }

  // ---- buildings ----
  const facades = [
    windowTex('#3a4a5a', '#202b36', '#ffd98a'),
    windowTex('#5a4a3a', '#2e241c', '#ffe9b0'),
    windowTex('#46586a', '#22303c', '#cfe8ff'),
    brickTex(),
    glassTex(),
  ];
  const facadeMats = facades.map((t) => new THREE.MeshStandardMaterial({ map: t, roughness: 0.85, metalness: 0.05 }));
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x4a4a48, roughness: 0.95 });
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const colliders = [];   // {minX,maxX,minZ,maxZ}
  const buildings = [];
  const isPlazaBlock = (bx, bz) => Math.abs(bx) < 28 && Math.abs(bz) < 28;
  const isHarborBlock = (bx, bz) => bx > 120;
  for (let i = 0; i < ROADS.length - 1; i++) {
    for (let j = 0; j < ROADS.length - 1; j++) {
      const cx = (ROADS[i] + ROADS[i + 1]) / 2;
      const cz = (ROADS[j] + ROADS[j + 1]) / 2;
      if (isPlazaBlock(cx, cz)) continue; // Founders Plaza stays open
      const downtown = Math.abs(cx) < 90 && Math.abs(cz) < 90;
      const harbor = isHarborBlock(cx, cz);
      // 1-2 buildings per block
      const count = harbor ? 1 : (downtown ? 2 : 1);
      for (let k = 0; k < count; k++) {
        const w = harbor ? 34 : rng.range(14, 26);
        const d = harbor ? 16 : rng.range(14, 26);
        const h = harbor ? rng.range(8, 12) : downtown ? rng.range(22, 58) : rng.range(8, 16);
        const ox = count === 1 ? 0 : (k === 0 ? -11 : 11);
        const oz = count === 1 ? 0 : (k === 0 ? -8 : 8);
        const x = cx + ox, z = cz + oz;
        if (Math.abs(x) > CITY_HALF - 12 || Math.abs(z) > CITY_HALF - 12) continue;
        const mat = harbor ? facadeMats[3] : facadeMats[rng.int(0, facadeMats.length - 1)];
        const b = new THREE.Mesh(boxGeo, mat);
        b.scale.set(w, h, d);
        b.position.set(x, h / 2, z);
        b.castShadow = true; b.receiveShadow = true;
        group.add(b);
        // rooftop box for silhouette variety
        if (h > 20 && rng.chance(0.6)) {
          const rt = new THREE.Mesh(boxGeo, roofMat);
          rt.scale.set(w * 0.4, 3, d * 0.4);
          rt.position.set(x + rng.range(-4, 4), h + 1.5, z + rng.range(-4, 4));
          rt.castShadow = true;
          group.add(rt);
        }
        colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
        buildings.push(b);
      }
    }
  }
  // harbor warehouse (the big one the mission shot must clear)
  const wh = new THREE.Mesh(boxGeo, facadeMats[3]);
  wh.scale.set(30, 11, 18);
  wh.position.set(WAREHOUSE.x, 5.5, WAREHOUSE.z);
  wh.castShadow = true; wh.receiveShadow = true;
  group.add(wh);
  colliders.push({ minX: WAREHOUSE.x - 15, maxX: WAREHOUSE.x + 15, minZ: WAREHOUSE.z - 9, maxZ: WAREHOUSE.z + 9 });

  // ---- trees: >=10 m off every road axis, inside blocks ----
  const treeCircles = [];
  const trunkGeo = new THREE.CylinderGeometry(0.25, 0.4, 3, 6);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5a3d24, roughness: 1 });
  const leafGeo = new THREE.IcosahedronGeometry(2.2, 0);
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x3f7a34, roughness: 1 });
  const trunkInst = new THREE.InstancedMesh(trunkGeo, trunkMat, 90);
  const leafInst = new THREE.InstancedMesh(leafGeo, leafMat, 90);
  trunkInst.castShadow = true; leafInst.castShadow = true;
  const m4 = new THREE.Matrix4();
  let ti = 0;
  for (let n = 0; n < 90; n++) {
    const bx = rng.range(-CITY_HALF + 16, CITY_HALF - 16);
    const bz = rng.range(-CITY_HALF + 16, CITY_HALF - 16);
    // keep >=10 m off every road axis
    let ok = true;
    for (const r of ROADS) { if (Math.abs(bx - r) < 10 || Math.abs(bz - r) < 10) { ok = false; break; } }
    if (!ok) continue;
    if (Math.hypot(bx - PLAZA.x, bz - PLAZA.z) < PLAZA.r + 6) continue;
    if (bx > 118) continue; // not on the harbor apron
    m4.makeTranslation(bx, 1.5, bz); trunkInst.setMatrixAt(ti, m4);
    m4.makeTranslation(bx, 4.6, bz); leafInst.setMatrixAt(ti, m4);
    treeCircles.push({ x: bx, z: bz, r: 1.1 });
    ti++;
  }
  trunkInst.count = ti; leafInst.count = ti;
  group.add(trunkInst); group.add(leafInst);

  // ---- street lamps (instanced) along roads ----
  const poleGeo = new THREE.CylinderGeometry(0.09, 0.12, 6, 6);
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x2c2c30, roughness: 0.6, metalness: 0.6 });
  const headGeo = new THREE.SphereGeometry(0.35, 8, 6);
  const headMat = new THREE.MeshStandardMaterial({ color: 0xffe9a8, emissive: 0xffd76a, emissiveIntensity: 0.9 });
  const lampSpots = [];
  for (const r of ROADS) for (let v = -168; v <= 168; v += 56) {
    lampSpots.push([r + 6, v]); lampSpots.push([v, r - 6]);
  }
  const poleInst = new THREE.InstancedMesh(poleGeo, poleMat, lampSpots.length);
  const headInst = new THREE.InstancedMesh(headGeo, headMat, lampSpots.length);
  lampSpots.forEach(([x, z], i) => {
    m4.makeTranslation(x, 3, z); poleInst.setMatrixAt(i, m4);
    m4.makeTranslation(x, 6.1, z); headInst.setMatrixAt(i, m4);
  });
  group.add(poleInst); group.add(headInst);

  // ---- traffic lights at the four central intersections ----
  const tlPoleMat = new THREE.MeshStandardMaterial({ color: 0x1c1c1e, roughness: 0.6 });
  const tlBoxGeo = new THREE.BoxGeometry(0.5, 1.4, 0.5);
  const tlMats = [
    new THREE.MeshStandardMaterial({ color: 0x330000, emissive: 0xff2a1a, emissiveIntensity: 1.2 }),
    new THREE.MeshStandardMaterial({ color: 0x332200, emissive: 0xffc21a, emissiveIntensity: 0.9 }),
    new THREE.MeshStandardMaterial({ color: 0x002200, emissive: 0x2aff5a, emissiveIntensity: 1.0 }),
  ];
  for (const [ix, iz] of [[0, 0], [56, 0], [0, 56], [-56, -56]]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 5, 6), tlPoleMat);
    pole.position.set(ix + 6, 2.5, iz + 6); pole.castShadow = true;
    group.add(pole);
    const box = new THREE.Mesh(tlBoxGeo, tlPoleMat);
    box.position.set(ix + 6, 5.2, iz + 6);
    group.add(box);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), tlMats[(ix + iz) % 3 < 0 ? 0 : (Math.abs(ix + iz) % 3)]);
    lamp.position.set(ix + 6, 5.2, iz + 5.7);
    group.add(lamp);
  }

  return { group, colliders, treeCircles, buildings, sun };
}
