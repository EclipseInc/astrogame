import * as THREE from "three";
import { mulberry32 } from "../core/noise.js";
import { CONFIG, DEG } from "../config.js";

/**
 * Небо рисуется отдельной сценой с собственной перспективной камерой,
 * которая копирует только поворот игровой. В изометрии небо почти всегда
 * закрыто поверхностью — оно нужно для интро и будущих низких ракурсов.
 */
export function createSky() {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, 1, 1, 4000);

  scene.add(makeStars());
  scene.add(makeEarth());

  return {
    scene,
    camera,
    resize(aspect) {
      camera.aspect = aspect;
      camera.updateProjectionMatrix();
    },
    sync(mainCamera) {
      camera.quaternion.copy(mainCamera.quaternion);
    },
  };
}

function makeStars() {
  const count = 2600;
  const rand = mulberry32(1312);
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    // Равномерно по сфере
    const u = rand() * 2 - 1;
    const theta = rand() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    const r = 2000;

    positions[i * 3 + 0] = Math.cos(theta) * s * r;
    positions[i * 3 + 1] = u * r;
    positions[i * 3 + 2] = Math.sin(theta) * s * r;

    // На Луне звёзды не мерцают, но по цвету различаются
    const warm = rand();
    const b = 0.5 + rand() * 0.5;
    colors[i * 3 + 0] = b * (0.85 + warm * 0.15);
    colors[i * 3 + 1] = b * 0.92;
    colors[i * 3 + 2] = b * (1.0 - warm * 0.12);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));

  return new THREE.Points(
    geo,
    new THREE.PointsMaterial({
      size: 2.2,
      sizeAttenuation: false,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
    })
  );
}

function earthTexture() {
  const w = 512;
  const h = 256;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  const rand = mulberry32(88);

  ctx.fillStyle = "#12385f";
  ctx.fillRect(0, 0, w, h);

  // Континенты
  ctx.fillStyle = "#3d6b4a";
  for (let i = 0; i < 26; i++) {
    const x = rand() * w;
    const y = 40 + rand() * (h - 80);
    ctx.beginPath();
    ctx.ellipse(x, y, 16 + rand() * 46, 10 + rand() * 26, rand() * 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // Облачность
  ctx.globalAlpha = 0.34;
  ctx.fillStyle = "#ffffff";
  for (let i = 0; i < 60; i++) {
    const x = rand() * w;
    const y = rand() * h;
    ctx.beginPath();
    ctx.ellipse(x, y, 12 + rand() * 40, 5 + rand() * 12, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Полярные шапки
  ctx.globalAlpha = 0.75;
  ctx.fillRect(0, 0, w, 16);
  ctx.fillRect(0, h - 16, w, 16);
  ctx.globalAlpha = 1;

  return new THREE.CanvasTexture(canvas);
}

function makeEarth() {
  const group = new THREE.Group();

  const earth = new THREE.Mesh(
    new THREE.SphereGeometry(90, 48, 32),
    new THREE.MeshStandardMaterial({
      map: earthTexture(),
      roughness: 0.9,
      metalness: 0,
      emissive: 0x0a1a2e,
      emissiveIntensity: 0.4,
    })
  );
  earth.rotation.z = 0.4;
  group.add(earth);

  // Земля висит над горизонтом почти неподвижно — ориентир для игрока.
  const az = CONFIG.sunAzimuth - 80 * DEG;
  const el = 34 * DEG;
  const dist = 1500;
  group.position.set(
    Math.sin(az) * Math.cos(el) * dist,
    Math.sin(el) * dist,
    Math.cos(az) * Math.cos(el) * dist
  );

  // Собственный свет, чтобы фаза Земли не зависела от солнца сцены
  const light = new THREE.DirectionalLight(0xfff2e0, 2.4);
  light.position.set(1, 0.3, 0.6);
  group.add(light);
  group.add(new THREE.AmbientLight(0x223344, 0.35));

  return group;
}
