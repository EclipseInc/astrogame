import { CONFIG } from "../config.js";
import { terrainHeight } from "../world/terrain.js";

const SIZE = 420; // сторона карты в CSS-пикселях
const TERRAIN_RES = 256; // разрешение подложки рельефа
const MAX_MARKERS = 8;
const HIT_RADIUS = 13; // радиус попадания по метке, в пикселях карты

/**
 * Карта на M. Мир 400×400 м рисуется один в один по метру на пиксель,
 * поэтому никаких прокруток и зума не нужно — вся Луна помещается сразу.
 */
export function createMinimap() {
  const root = document.getElementById("map");
  const canvas = document.getElementById("map-canvas");
  const counter = document.getElementById("map-count");
  const closeBtn = document.getElementById("map-close");
  const ctx = canvas.getContext("2d");

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = SIZE * dpr;
  canvas.height = SIZE * dpr;
  ctx.scale(dpr, dpr);

  let terrainLayer = null; // строится лениво при первом открытии
  let open = false;
  const markers = [];

  /** Мир → пиксели карты. */
  const toMap = (x, z) => ({
    px: ((x + CONFIG.worldSize / 2) / CONFIG.worldSize) * SIZE,
    py: ((z + CONFIG.worldSize / 2) / CONFIG.worldSize) * SIZE,
  });

  /** Пиксели карты → мир. */
  const toWorld = (px, py) => ({
    x: (px / SIZE) * CONFIG.worldSize - CONFIG.worldSize / 2,
    z: (py / SIZE) * CONFIG.worldSize - CONFIG.worldSize / 2,
  });

  function buildTerrainLayer() {
    const off = document.createElement("canvas");
    off.width = off.height = TERRAIN_RES;
    const octx = off.getContext("2d");
    const img = octx.createImageData(TERRAIN_RES, TERRAIN_RES);

    const step = CONFIG.worldSize / TERRAIN_RES;
    const half = CONFIG.worldSize / 2;

    for (let j = 0; j < TERRAIN_RES; j++) {
      const z = -half + j * step;
      for (let i = 0; i < TERRAIN_RES; i++) {
        const x = -half + i * step;
        const h = terrainHeight(x, z);
        // Освещение как в игре — сбоку, чтобы кратеры читались рельефом
        const slope = terrainHeight(x + step, z) - terrainHeight(x - step, z);

        const base = 44 + Math.max(-1, Math.min(1, h / 9)) * 26;
        const lit = base - slope * 9;
        const v = Math.max(12, Math.min(150, lit));

        const k = (j * TERRAIN_RES + i) * 4;
        img.data[k] = v;
        img.data[k + 1] = v * 1.01;
        img.data[k + 2] = v * 1.08;
        img.data[k + 3] = 255;
      }
    }
    octx.putImageData(img, 0, 0);
    return off;
  }

  function drawMarker(px, py, index) {
    ctx.save();
    ctx.translate(px, py);

    ctx.beginPath();
    ctx.moveTo(0, -9);
    ctx.lineTo(7, 0);
    ctx.lineTo(0, 9);
    ctx.lineTo(-7, 0);
    ctx.closePath();

    ctx.fillStyle = "rgba(127, 212, 193, 0.9)";
    ctx.fill();
    ctx.strokeStyle = "rgba(8, 14, 18, 0.9)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = "#08131a";
    ctx.font = "700 9px ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(index + 1), 0, 0.5);
    ctx.restore();
  }

  function drawStation() {
    const { px, py } = toMap(0, 0);
    ctx.beginPath();
    ctx.arc(px, py, 7, 0, Math.PI * 2);
    ctx.strokeStyle = "#e8eaec";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(px, py, 2.2, 0, Math.PI * 2);
    ctx.fillStyle = "#e8eaec";
    ctx.fill();

    ctx.fillStyle = "#c3ced8";
    ctx.font = "10px ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.fillText("АНТЕННА", px, py + 21);
  }

  function drawTarget(target, time) {
    if (!target) return;
    const { px, py } = toMap(target.x, target.z);
    const pulse = 9 + Math.sin(time * 3) * 3;

    ctx.beginPath();
    ctx.arc(px, py, pulse, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(232, 112, 58, 0.85)";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(px, py, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = "#e8703a";
    ctx.fill();
  }

  /** Находки появляются на карте только после того, как их нашли. */
  function drawFinds(finds) {
    if (!finds) return;
    for (const find of finds) {
      if (!find.found) continue;
      const { px, py } = toMap(find.x, find.z);

      ctx.save();
      ctx.translate(px, py);
      ctx.strokeStyle = "rgba(232, 112, 58, 0.9)";
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(-4, -4); ctx.lineTo(4, 4);
      ctx.moveTo(4, -4); ctx.lineTo(-4, 4);
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawPlayer(position, facing) {
    const { px, py } = toMap(position.x, position.z);
    ctx.save();
    ctx.translate(px, py);
    // facing = atan2(vx, vz): 0 смотрит в +z, то есть вниз по карте
    ctx.rotate(-facing + Math.PI);

    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.lineTo(5.5, 6);
    ctx.lineTo(0, 3);
    ctx.lineTo(-5.5, 6);
    ctx.closePath();
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.strokeStyle = "rgba(8, 14, 18, 0.9)";
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.restore();
  }

  const api = {
    get open() {
      return open;
    },

    get markers() {
      return markers;
    },

    toggle() {
      open ? api.close() : api.show();
    },

    show() {
      if (!terrainLayer) terrainLayer = buildTerrainLayer();
      open = true;
      root.classList.add("shown");
      // Тач-панель под открытой картой только мешает
      document.body.classList.add("map-open");
    },

    close() {
      open = false;
      root.classList.remove("shown");
      document.body.classList.remove("map-open");
    },

    /** Рисует кадр карты. Вызывать только когда она открыта. */
    draw({ position, facing, target, time, finds }) {
      ctx.clearRect(0, 0, SIZE, SIZE);

      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(terrainLayer, 0, 0, SIZE, SIZE);

      // сетка на 50 м — чтобы прикидывать расстояния
      ctx.strokeStyle = "rgba(255, 255, 255, 0.06)";
      ctx.lineWidth = 1;
      for (let m = -150; m <= 150; m += 50) {
        const { px } = toMap(m, 0);
        const { py } = toMap(0, m);
        ctx.beginPath();
        ctx.moveTo(px, 0);
        ctx.lineTo(px, SIZE);
        ctx.moveTo(0, py);
        ctx.lineTo(SIZE, py);
        ctx.stroke();
      }

      drawTarget(target, time);
      drawFinds(finds);
      drawStation();
      markers.forEach((m, i) => {
        const { px, py } = toMap(m.x, m.z);
        drawMarker(px, py, i);
      });
      drawPlayer(position, facing);
    },
  };

  /** Клик ставит метку; попадание по существующей — снимает её. */
  canvas.addEventListener("click", (e) => {
    const rect = canvas.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * SIZE;
    const py = ((e.clientY - rect.top) / rect.height) * SIZE;

    const hit = markers.findIndex((m) => {
      const p = toMap(m.x, m.z);
      return Math.hypot(p.px - px, p.py - py) < HIT_RADIUS;
    });

    if (hit >= 0) markers.splice(hit, 1);
    else if (markers.length < MAX_MARKERS) markers.push(toWorld(px, py));

    counter.textContent = `${markers.length} / ${MAX_MARKERS}`;
  });

  closeBtn.addEventListener("click", () => api.close());

  // Правый клик по карте не должен открывать системное меню
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());

  counter.textContent = `0 / ${MAX_MARKERS}`;
  return api;
}
