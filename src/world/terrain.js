import * as THREE from "three";
import { fbm, mulberry32 } from "../core/noise.js";
import { CONFIG } from "../config.js";

// Кратеры задаём явно, а не шумом: так их можно расставить под геймплей.
// r — радиус чаши, depth — глубина, rim — высота вала по краю.
export const CRATERS = [
  { x: -78, z: 62, r: 46, depth: 11, rim: 2.6 }, // главный кратер (акт 2)
  { x: 96, z: -54, r: 30, depth: 6, rim: 1.6 },
  { x: 40, z: 96, r: 18, depth: 3.4, rim: 1.0 },
  { x: -120, z: -80, r: 26, depth: 5, rim: 1.4 },
];

const smoothstep = (edge0, edge1, x) => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

/** Высота поверхности в мировых координатах. Единственный источник правды о рельефе. */
export function terrainHeight(x, z) {
  // Крупные волны реголита
  let h = fbm(x * 0.0055, z * 0.0055, 4) * 7;
  // Мелкая рябь
  h += fbm(x * 0.032 + 100, z * 0.032 + 100, 3) * 1.3;

  for (const c of CRATERS) {
    const d = Math.hypot(x - c.x, z - c.z);
    const t = d / c.r;
    if (t < 2) {
      if (t < 1) h -= c.depth * (1 - t * t);
      // вал по кромке
      h += c.rim * Math.exp(-Math.pow((t - 1.0) / 0.22, 2));
    }
  }

  // Площадка вокруг станции: там стоит антенна и учится управление.
  const dOrigin = Math.hypot(x, z);
  h *= smoothstep(10, 34, dOrigin);

  return h;
}

/** Нормаль поверхности через конечные разности — для маркера приземления и следов. */
export function terrainNormal(x, z, out = new THREE.Vector3()) {
  const e = 0.6;
  const hL = terrainHeight(x - e, z);
  const hR = terrainHeight(x + e, z);
  const hD = terrainHeight(x, z - e);
  const hU = terrainHeight(x, z + e);
  return out.set(hL - hR, 2 * e, hD - hU).normalize();
}

function grainTexture() {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  const img = ctx.createImageData(size, size);
  const rand = mulberry32(7);

  for (let i = 0; i < size * size; i++) {
    // Реголит — очень мелкий контраст, крупные пятна выглядят как ковёр.
    const v = 150 + (rand() - 0.5) * 46 + (rand() < 0.02 ? -30 : 0);
    img.data[i * 4 + 0] = v;
    img.data[i * 4 + 1] = v;
    img.data[i * 4 + 2] = v * 0.98;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(90, 90);
  tex.anisotropy = 8;
  return tex;
}

export function createTerrain() {
  const { worldSize, terrainSegments } = CONFIG;
  const geo = new THREE.PlaneGeometry(
    worldSize,
    worldSize,
    terrainSegments,
    terrainSegments
  );
  geo.rotateX(-Math.PI / 2);

  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const rand = mulberry32(21);

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    pos.setY(i, terrainHeight(x, z));

    // Лёгкая вариация альбедо, чтобы поверхность не читалась как пластик
    const v = 0.86 + (rand() - 0.5) * 0.14;
    colors[i * 3 + 0] = v;
    colors[i * 3 + 1] = v;
    colors[i * 3 + 2] = v * 0.97;
  }

  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
    color: 0xb4b3b1,
    map: grainTexture(),
    vertexColors: true,
    roughness: 1.0,
    metalness: 0.0,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.name = "terrain";
  return mesh;
}
