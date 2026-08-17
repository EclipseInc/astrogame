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
  cancel: ["Escape"],
};

export function createInput() {
  const down = new Set();
  const pressed = new Set(); // «нажато в этом кадре»

  const isDown = (action) => KEYS[action].some((c) => down.has(c));

  window.addEventListener("keydown", (e) => {
    if (Object.values(KEYS).flat().includes(e.code)) e.preventDefault();
    if (!down.has(e.code)) pressed.add(e.code);
    down.add(e.code);
  });

  window.addEventListener("keyup", (e) => down.delete(e.code));
  window.addEventListener("blur", () => down.clear());

  return {
    get moveX() {
      return (isDown("right") ? 1 : 0) - (isDown("left") ? 1 : 0);
    },
    get moveZ() {
      return (isDown("forward") ? 1 : 0) - (isDown("back") ? 1 : 0);
    },
    get jumpHeld() {
      return isDown("jump");
    },
    justPressed(action) {
      return KEYS[action].some((c) => pressed.has(c));
    },
    /** Вызывать в конце кадра. */
    endFrame() {
      pressed.clear();
    },
  };
}
