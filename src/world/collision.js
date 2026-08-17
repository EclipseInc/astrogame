import { terrainHeight } from "./terrain.js";

/** Круглые препятствия без верха: мачта антенны и прочее, на что не залезть. */
export const blockers = [];
/** Твёрдые тела: {x, z, r, top}. Сбоку — стена, сверху — опора. */
export const platforms = [];

/**
 * Порог «шага». Уступ ниже него игрок переступает пешком (площадка станции,
 * бордюры), выше — только прыжком. Без этого низкая площадка работала бы
 * как стена, в которую упираешься.
 */
const STEP_UP = 0.55;

/**
 * Пространственный индекс. Камней в мире под две сотни, а surfaceHeightAt
 * дёргается на каждую частицу пыли — перебор всего списка на кадр съедал бы
 * больше, чем вся остальная игра.
 */
const CELL = 16;
const grid = new Map();

const key = (cx, cz) => cx * 73856093 ^ cz * 19349663;

function index(item, bucket) {
  const minX = Math.floor((item.x - item.r) / CELL);
  const maxX = Math.floor((item.x + item.r) / CELL);
  const minZ = Math.floor((item.z - item.r) / CELL);
  const maxZ = Math.floor((item.z + item.r) / CELL);

  for (let cx = minX; cx <= maxX; cx++) {
    for (let cz = minZ; cz <= maxZ; cz++) {
      const k = key(cx, cz);
      let cell = grid.get(k);
      if (!cell) grid.set(k, (cell = { platforms: [], blockers: [] }));
      cell[bucket].push(item);
    }
  }
}

const EMPTY = { platforms: [], blockers: [] };

/** Ячейки, задевающие круг радиуса r вокруг точки (обычно радиус игрока). */
function cellsNear(x, z, r = 0) {
  const minX = Math.floor((x - r) / CELL);
  const maxX = Math.floor((x + r) / CELL);
  const minZ = Math.floor((z - r) / CELL);
  const maxZ = Math.floor((z + r) / CELL);

  if (minX === maxX && minZ === maxZ) return [grid.get(key(minX, minZ)) ?? EMPTY];

  const out = [];
  for (let cx = minX; cx <= maxX; cx++) {
    for (let cz = minZ; cz <= maxZ; cz++) {
      const cell = grid.get(key(cx, cz));
      if (cell) out.push(cell);
    }
  }
  return out.length ? out : [EMPTY];
}

export function addBlocker(x, z, r) {
  const b = { x, z, r };
  blockers.push(b);
  index(b, "blockers");
  return b;
}

export function addPlatform(x, z, r, top) {
  const p = { x, z, r, top };
  platforms.push(p);
  index(p, "platforms");
  return p;
}

/**
 * Высота опоры под точкой с учётом твёрдых тел.
 * y — текущая высота игрока: встаём только на то, что не выше шага.
 */
export function groundHeightAt(x, z, y = Infinity) {
  let h = terrainHeight(x, z);
  for (const cell of cellsNear(x, z)) {
    for (const p of cell.platforms) {
      if (p.top <= h) continue;
      const dx = x - p.x;
      const dz = z - p.z;
      if (dx * dx + dz * dz <= p.r * p.r && y >= p.top - STEP_UP) h = p.top;
    }
  }
  return h;
}

/** Самая верхняя поверхность в точке — для маркера приземления и пыли. */
export function surfaceHeightAt(x, z) {
  let h = terrainHeight(x, z);
  for (const cell of cellsNear(x, z)) {
    for (const p of cell.platforms) {
      const dx = x - p.x;
      const dz = z - p.z;
      if (dx * dx + dz * dz <= p.r * p.r) h = Math.max(h, p.top);
    }
  }
  return h;
}

/** Выталкивает точку из препятствий. Мутирует pos (Vector3). */
export function resolveHorizontal(pos, radius) {
  for (const cell of cellsNear(pos.x, pos.z, radius)) {
    for (const b of cell.blockers) {
      pushOut(pos, radius, b.x, b.z, b.r);
    }
    for (const p of cell.platforms) {
      // Сбоку — стена; на низкий уступ просто вступаем.
      if (pos.y < p.top - STEP_UP) pushOut(pos, radius, p.x, p.z, p.r);
    }
  }
}

function pushOut(pos, radius, cx, cz, cr) {
  const dx = pos.x - cx;
  const dz = pos.z - cz;
  const min = cr + radius;
  const d2 = dx * dx + dz * dz;
  if (d2 >= min * min || d2 === 0) return;
  const d = Math.sqrt(d2);
  const k = (min - d) / d;
  pos.x += dx * k;
  pos.z += dz * k;
}
