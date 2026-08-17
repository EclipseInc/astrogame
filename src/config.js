const DEG = Math.PI / 180;

export const CONFIG = {
  // --- Физика ---
  // Не настоящие 1.62 м/с²: при реальной луне прыжок длится ~8 секунд и играть невозможно.
  // Подобрано так, чтобы прыжок был ~3 м в высоту и ~2 с в воздухе — «лунно», но управляемо.
  gravity: 6.0,
  jumpSpeed: 6.0,
  moveSpeed: 5.2,
  groundAccel: 26,
  airControl: 0.45, // доля ускорения, доступная в полёте
  coyoteTime: 0.12, // окно прыжка после схода с края
  jumpBuffer: 0.15, // окно «нажал раньше, чем приземлился»

  // --- Камера ---
  camElevation: 40 * DEG, // угол над горизонтом
  camDistance: 60,
  camViewSize: 12.5, // половина высоты ортокамеры в метрах
  camFollowLag: 6, // скорость догона игрока
  camRotateTime: 0.45, // длительность поворота на 90°

  // --- Солнце ---
  sunElevation: 16 * DEG, // низко над горизонтом → длинные тени, но площадки не тонут в них
  sunAzimuth: 125 * DEG,

  // --- Игра ---
  oxygenSeconds: 240,
  oxygenLowAt: 60,
  pickupRadius: 2.2,
  depositRadius: 4.0,

  // --- Мир ---
  worldSize: 400,
  terrainSegments: 220,
};

export { DEG };
