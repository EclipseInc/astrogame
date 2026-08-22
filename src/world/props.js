import * as THREE from "three";
import { mulberry32 } from "../core/noise.js";
import { terrainHeight, CRATERS } from "./terrain.js";
import { addBlocker, addPlatform } from "./collision.js";

const rockMat = new THREE.MeshStandardMaterial({
  color: 0x74726d,
  roughness: 0.98,
  metalness: 0,
  flatShading: true,
});

const darkRockMat = new THREE.MeshStandardMaterial({
  color: 0x5c5a56,
  roughness: 1,
  metalness: 0,
  flatShading: true,
});

const metalMat = new THREE.MeshStandardMaterial({
  color: 0xb9bcc0,
  roughness: 0.45,
  metalness: 0.7,
});

const panelMat = new THREE.MeshStandardMaterial({
  color: 0x424b55,
  roughness: 0.6,
  metalness: 0.3,
});

const _box = new THREE.Box3();
const _size = new THREE.Vector3();
const _center = new THREE.Vector3();

/**
 * Регистрирует объект как твёрдое тело по его реальным габаритам: сбоку в него
 * упираешься, сверху на него можно запрыгнуть и стоять.
 * grip < 1 — площадка чуть уже силуэта, чтобы не стоять на пустом воздухе у края.
 */
function registerSolid(object, { grip = 0.72, sink = 0.14, minR = 0.4, kind = "rock" } = {}) {
  object.updateMatrixWorld(true);
  _box.setFromObject(object);
  _box.getSize(_size);
  _box.getCenter(_center);

  const r = Math.max(minR, Math.min(_size.x, _size.z) * 0.5 * grip);
  const top = _box.max.y - _size.y * sink;
  const p = addPlatform(_center.x, _center.z, r, top);
  p.kind = kind;
  return p;
}

/** Один валун: икосаэдр со случайным сжатием — читается как обломок породы. */
function boulder(x, z, radius, rand, mat = rockMat) {
  const geo = new THREE.IcosahedronGeometry(radius, 0);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.scale.set(
    1 + (rand() - 0.5) * 0.5,
    0.65 + rand() * 0.5,
    1 + (rand() - 0.5) * 0.5
  );
  mesh.rotation.set(rand() * 3, rand() * 6, rand() * 3);
  mesh.position.set(x, terrainHeight(x, z) + radius * 0.35, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export function createBoulders(scene, keepClear = []) {
  const rand = mulberry32(4242);
  const group = new THREE.Group();
  group.name = "boulders";

  let placed = 0;
  let guard = 0;
  while (placed < 190 && guard++ < 4000) {
    const x = (rand() - 0.5) * 360;
    const z = (rand() - 0.5) * 360;

    // Площадка станции остаётся чистой
    if (Math.hypot(x, z) < 13) continue;
    // Точки интереса не заваливаем
    if (keepClear.some((p) => Math.hypot(x - p.x, z - p.z) < (p.r ?? 5))) continue;

    const radius = 0.5 + rand() * rand() * 3.4;
    const mesh = boulder(x, z, radius, rand);
    group.add(mesh);
    // Каждый валун — твёрдый: в мелкие упираешься, на крупные запрыгиваешь.
    registerSolid(mesh);
    placed++;
  }

  // Мелкая щебёнка — без коллизии, только для плотности картинки
  for (let i = 0; i < 320; i++) {
    const x = (rand() - 0.5) * 320;
    const z = (rand() - 0.5) * 320;
    group.add(boulder(x, z, 0.16 + rand() * 0.3, rand, darkRockMat));
  }

  scene.add(group);
  return group;
}

/** Уступы, по которым игрок спускается в кратер и выбирается обратно (акт 2). */
export function createCraterSteps(scene) {
  const crater = CRATERS[0];
  const rand = mulberry32(909);
  const group = new THREE.Group();
  group.name = "craterSteps";

  const steps = 8;
  // Спускаемся по дуге от кромки к центру — так прыжки идут по диагонали экрана.
  // Угол выбран так, чтобы лестница легла на освещённую стенку кратера:
  // противоположная сторона всё время в тени вала и играть там вслепую.
  const startAngle = 2.1;

  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    const angle = startAngle + t * 0.9;
    const dist = crater.r * (1.02 - t * 0.86);
    const x = crater.x + Math.cos(angle) * dist;
    const z = crater.z + Math.sin(angle) * dist;

    const ground = terrainHeight(x, z);
    // Верх уступа поднят над дном тем сильнее, чем ближе к кромке
    const top = ground + 1.4 + (1 - t) * 1.1;
    const r = 2.3 + rand() * 0.9;

    const height = top - (ground - 3);
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(r, r * 1.18, height, 7),
      rockMat
    );
    mesh.position.set(x, top - height / 2, z);
    mesh.rotation.y = rand() * 6;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);

    addPlatform(x, z, r * 0.94, top);
  }

  scene.add(group);
  return group;
}

/** Гряда, отбрасывающая длинную тень: зона акта 3. */
export function createShadowRidge(scene, target) {
  const rand = mulberry32(77);
  const group = new THREE.Group();
  group.name = "ridge";

  // Ставим стену между целью и солнцем (солнце примерно в +x / -z)
  const baseX = target.x + 14;
  const baseZ = target.z - 10;

  for (let i = 0; i < 9; i++) {
    const off = (i - 4) * 7.5;
    const x = baseX + off * 0.6;
    const z = baseZ + off * 0.85;
    const r = 4 + rand() * 2.5;

    const geo = new THREE.IcosahedronGeometry(r, 0);
    const mesh = new THREE.Mesh(geo, darkRockMat);
    mesh.scale.set(1, 1.9 + rand() * 0.9, 1);
    mesh.rotation.y = rand() * 6;
    mesh.position.set(x, terrainHeight(x, z) + r * 0.9, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);

    registerSolid(mesh);
  }

  scene.add(group);
  return group;
}

const crystalMat = new THREE.MeshStandardMaterial({
  color: 0x0e2a30,
  emissive: 0x2fd6b8,
  // Выше ~1.5 тон-маппинг выбеливает кристаллы в белый и цвет теряется
  emissiveIntensity: 1.35,
  roughness: 0.25,
  metalness: 0.1,
  flatShading: true,
});

const crystalMatWarm = new THREE.MeshStandardMaterial({
  color: 0x2a1030,
  emissive: 0x9d5fe0,
  emissiveIntensity: 1.25,
  roughness: 0.25,
  metalness: 0.1,
  flatShading: true,
});

/** Кучка кристаллов: в вечной тени это единственное, что видно без фонаря. */
function crystalCluster(parent, x, y, z, rand, count = 4, scale = 1) {
  for (let i = 0; i < count; i++) {
    const h = (0.4 + rand() * 0.7) * scale;
    const mesh = new THREE.Mesh(
      new THREE.ConeGeometry(0.11 * scale + rand() * 0.06, h, 5),
      rand() < 0.3 ? crystalMatWarm : crystalMat
    );
    const a = rand() * Math.PI * 2;
    const d = rand() * 0.5 * scale;
    mesh.position.set(x + Math.cos(a) * d, y + h * 0.45, z + Math.sin(a) * d);
    mesh.rotation.set((rand() - 0.5) * 0.5, rand() * 6, (rand() - 0.5) * 0.5);
    parent.add(mesh);
  }
}

/**
 * Акт 3: поле колонн в тёмном кратере. Прыгать приходится вслепую — работают
 * только фонарь и маркер приземления, а кристаллы показывают, где следующая
 * колонна. Промах не убивает: падаешь на дно и выбираешься через кромку,
 * теряя кислород. Наказание временем, а не смертью.
 */
export function createShadowCourse(scene, { crater, target, approach }) {
  const rand = mulberry32(5150);
  const group = new THREE.Group();
  group.name = "shadowCourse";

  // Стартуем на кромке с той стороны, откуда игрок приходит
  const a0 = Math.atan2(approach.z - crater.z, approach.x - crater.x);
  const start = {
    x: crater.x + Math.cos(a0) * crater.r * 1.05,
    z: crater.z + Math.sin(a0) * crater.r * 1.05,
  };

  const dx = target.x - start.x;
  const dz = target.z - start.z;
  const len = Math.hypot(dx, dz);
  const dir = { x: dx / len, z: dz / len };
  const perp = { x: dir.z, z: -dir.x };

  const COUNT = 6;
  const columns = [];

  for (let i = 0; i < COUNT; i++) {
    const t = i / (COUNT - 1);
    // Зигзаг: прыжки идут по диагонали экрана, как и на ступенях кратера
    const zig = i === 0 || i === COUNT - 1 ? 0 : (i % 2 ? 1 : -1) * (2.2 + rand() * 1.1);

    const x = start.x + dir.x * len * t + perp.x * zig;
    const z = start.z + dir.z * len * t + perp.z * zig;

    const ground = terrainHeight(x, z);
    // Ниже высоты прыжка (3 м) только крайние: с них можно вернуться с дна
    const rise = 2.0 + Math.sin(t * Math.PI) * 1.3;
    const top = ground + rise;
    const r = i === COUNT - 1 ? 2.4 : 1.5 + rand() * 0.45;

    const height = top - (ground - 4);
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(r, r * 1.1, height, 6),
      darkRockMat
    );
    mesh.position.set(x, top - height / 2, z);
    mesh.rotation.y = rand() * 6;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);

    crystalCluster(group, x, top, z, rand, i === COUNT - 1 ? 7 : 4, i === COUNT - 1 ? 1.4 : 1);

    // Реальный свет — не на каждой колонне: источники дороже, чем свечение
    if (i % 2 === 1 || i === COUNT - 1) {
      const light = new THREE.PointLight(0x54e0c8, 7, 13, 2);
      light.position.set(x, top + 0.7, z);
      group.add(light);
    }

    const p = addPlatform(x, z, r * 0.95, top);
    p.kind = "column";
    columns.push({ x, z, r, top });
  }

  // Кристаллы на дне: упал — видно, куда идти, чтобы выбраться
  for (let i = 0; i < 14; i++) {
    const a = rand() * Math.PI * 2;
    const d = rand() * crater.r * 0.8;
    const x = crater.x + Math.cos(a) * d;
    const z = crater.z + Math.sin(a) * d;
    crystalCluster(group, x, terrainHeight(x, z), z, rand, 2, 0.7);
  }

  scene.add(group);
  return { group, columns, start, finish: columns[COUNT - 1] };
}

/** Антенна станции: сюда возвращают энергоячейки. */
export function createStation(scene) {
  const group = new THREE.Group();
  group.name = "station";
  const baseY = terrainHeight(0, 0);

  const pad = new THREE.Mesh(
    new THREE.CylinderGeometry(5.2, 5.6, 0.5, 24),
    panelMat
  );
  pad.position.set(0, baseY + 0.25, 0);
  pad.receiveShadow = true;
  group.add(pad);

  const mast = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.34, 9, 10),
    metalMat
  );
  mast.position.set(0, baseY + 5, 0);
  mast.castShadow = true;
  group.add(mast);

  const dish = new THREE.Mesh(
    new THREE.SphereGeometry(2.6, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.42),
    new THREE.MeshStandardMaterial({
      color: 0xd6d9dd,
      roughness: 0.35,
      metalness: 0.5,
      side: THREE.DoubleSide,
    })
  );
  dish.position.set(0, baseY + 9.4, 0);
  dish.rotation.set(Math.PI * 0.72, 0, 0.3);
  dish.castShadow = true;
  group.add(dish);

  // Три гнезда под энергоячейки
  const sockets = [];
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.5;
    const socket = new THREE.Group();
    socket.position.set(Math.cos(a) * 2.9, baseY + 0.5, Math.sin(a) * 2.9);

    const holder = new THREE.Mesh(
      new THREE.BoxGeometry(1.0, 0.9, 1.0),
      panelMat
    );
    holder.position.y = 0.45;
    holder.castShadow = true;
    socket.add(holder);

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.42, 0.07, 8, 18),
      new THREE.MeshStandardMaterial({
        color: 0x1c2228,
        emissive: 0x000000,
        roughness: 0.4,
      })
    );
    ring.position.y = 0.95;
    ring.rotation.x = -Math.PI / 2;
    socket.add(ring);

    group.add(socket);
    sockets.push({ group: socket, ring, filled: false });
  }

  addBlocker(0, 0, 1.1); // мачта — на неё не залезть
  // Площадка ниже порога шага: на неё входишь пешком, а не упираешься.
  addPlatform(0, 0, 5.3, baseY + 0.5);
  // Тумбы гнёзд — низкие подставки, на них можно встать
  for (const s of sockets) {
    addPlatform(s.group.position.x, s.group.position.z, 0.6, baseY + 1.4);
  }

  scene.add(group);
  return { group, dish, sockets, baseY };
}

/** Разбитый ровер у точки старта — заодно крючок для будущей механики транспорта. */
export function createRover(scene, x, z) {
  const group = new THREE.Group();
  group.name = "rover";
  const y = terrainHeight(x, z);
  group.position.set(x, y, z);
  group.rotation.set(0.16, 0.9, -0.28);

  const body = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.8, 2.0), panelMat);
  body.position.y = 1.0;
  body.castShadow = true;
  group.add(body);

  const rack = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.6, 1.6), metalMat);
  rack.position.set(-0.7, 1.6, 0);
  rack.castShadow = true;
  group.add(rack);

  const wheelGeo = new THREE.CylinderGeometry(0.62, 0.62, 0.34, 12);
  const wheelMat = new THREE.MeshStandardMaterial({
    color: 0x33383d,
    roughness: 0.9,
  });
  for (const [wx, wz] of [
    [1.3, 1.05],
    [1.3, -1.05],
    [-1.3, 1.05],
    [-1.3, -1.05],
  ]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.x = Math.PI / 2;
    w.position.set(wx, 0.62, wz);
    w.castShadow = true;
    group.add(w);
  }

  // Оторванное колесо рядом — читается как авария
  const loose = new THREE.Mesh(wheelGeo, wheelMat);
  loose.position.set(x + 3.2, terrainHeight(x + 3.2, z + 1.6) + 0.2, z + 1.6);
  loose.rotation.set(0.2, 0, 1.2);
  loose.castShadow = true;
  scene.add(loose);

  scene.add(group);
  // На разбитый ровер можно забраться — заодно самая заметная «ступенька» у старта
  registerSolid(group, { grip: 0.85 });
  return group;
}
