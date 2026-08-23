const KEYS = {
  forward: ["KeyW", "ArrowUp"],
  back: ["KeyS", "ArrowDown"],
  left: ["KeyA", "ArrowLeft"],
  right: ["KeyD", "ArrowRight"],
  jump: ["Space"],
  rotateLeft: ["KeyQ"],
  rotateRight: ["KeyE"],
  torch: ["KeyF"],
  map: ["KeyM"],
  ride: ["KeyR"],
  cancel: ["Escape"],
};

export function createInput() {
  const down = new Set();
  const pressed = new Set(); // «нажато в этом кадре»

  // Виртуальный слой: тач-управление подаёт сюда те же действия, что и клавиши,
  // поэтому игровой логике всё равно, откуда пришёл ввод.
  const axis = { x: 0, z: 0 };
  const virtualHeld = new Set();
  const virtualPressed = new Set();

  const isDown = (action) =>
    KEYS[action].some((c) => down.has(c)) || virtualHeld.has(action);

  window.addEventListener("keydown", (e) => {
    if (Object.values(KEYS).flat().includes(e.code)) e.preventDefault();
    if (!down.has(e.code)) pressed.add(e.code);
    down.add(e.code);
  });

  window.addEventListener("keyup", (e) => down.delete(e.code));
  window.addEventListener("blur", () => down.clear());

  return {
    get moveX() {
      const keys = (isDown("right") ? 1 : 0) - (isDown("left") ? 1 : 0);
      return keys || axis.x;
    },

    get moveZ() {
      const keys = (isDown("forward") ? 1 : 0) - (isDown("back") ? 1 : 0);
      return keys || axis.z;
    },

    /** Ось стика: значения от -1 до 1. */
    setAxis(x, z) {
      axis.x = x;
      axis.z = z;
    },

    /** Разовое нажатие с экранной кнопки — живёт до конца кадра. */
    press(action) {
      virtualPressed.add(action);
    },

    /** Удержание экранной кнопки (прыжок). */
    setHeld(action, held) {
      if (held) virtualHeld.add(action);
      else virtualHeld.delete(action);
    },
    get jumpHeld() {
      return isDown("jump");
    },
    justPressed(action) {
      return KEYS[action].some((c) => pressed.has(c)) || virtualPressed.has(action);
    },

    /** Вызывать в конце кадра. */
    endFrame() {
      pressed.clear();
      virtualPressed.clear();
    },
  };
}
