/**
 * Управление с телефона. Ввод подаётся в тот же input, что и клавиатура,
 * поэтому игровая логика ничего не знает о тачах.
 *
 * Показывается только на устройствах с «грубым» указателем: на десктопе
 * экранные кнопки только мешали бы.
 */

const DEAD_ZONE = 0.16; // ниже этого стик считается отпущенным
const KNOB_RANGE = 46; // на сколько пикселей ручка отходит от центра

export function createTouchControls(input) {
  const root = document.getElementById("touch");
  const stick = document.getElementById("stick");
  const knob = document.getElementById("stick-knob");

  const isTouch =
    window.matchMedia("(pointer: coarse)").matches ||
    navigator.maxTouchPoints > 0 ||
    new URLSearchParams(location.search).has("touch"); // для стенда

  if (!isTouch) return { enabled: false, update() {} };

  document.body.classList.add("touch-mode");

  // --- Стик ---
  let stickId = null;
  const center = { x: 0, y: 0 };

  const setKnob = (dx, dy) => {
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
  };

  stick.addEventListener("pointerdown", (e) => {
    stickId = e.pointerId;
    stick.setPointerCapture(e.pointerId);
    const r = stick.getBoundingClientRect();
    center.x = r.left + r.width / 2;
    center.y = r.top + r.height / 2;
    stick.classList.add("active");
  });

  const moveStick = (e) => {
    if (e.pointerId !== stickId) return;
    e.preventDefault();

    let dx = e.clientX - center.x;
    let dy = e.clientY - center.y;
    const len = Math.hypot(dx, dy) || 1;
    const clamped = Math.min(len, KNOB_RANGE);
    dx = (dx / len) * clamped;
    dy = (dy / len) * clamped;
    setKnob(dx, dy);

    const nx = dx / KNOB_RANGE;
    const ny = dy / KNOB_RANGE;
    const mag = Math.hypot(nx, ny);
    // Экран: вниз это +Y, а в игре «вперёд» — это -Z, отсюда минус
    if (mag < DEAD_ZONE) input.setAxis(0, 0);
    else input.setAxis(nx, -ny);
  };

  const releaseStick = (e) => {
    if (e.pointerId !== stickId) return;
    stickId = null;
    stick.classList.remove("active");
    setKnob(0, 0);
    input.setAxis(0, 0);
  };

  stick.addEventListener("pointermove", moveStick);
  stick.addEventListener("pointerup", releaseStick);
  stick.addEventListener("pointercancel", releaseStick);

  // --- Кнопки ---
  // data-hold — удержание (прыжок), остальные срабатывают один раз
  for (const btn of root.querySelectorAll("[data-action]")) {
    const action = btn.dataset.action;
    const hold = btn.hasAttribute("data-hold");

    btn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      btn.setPointerCapture(e.pointerId);
      btn.classList.add("active");
      input.press(action);
      if (hold) input.setHeld(action, true);
    });

    const up = (e) => {
      btn.classList.remove("active");
      if (hold) input.setHeld(action, false);
    };
    btn.addEventListener("pointerup", up);
    btn.addEventListener("pointercancel", up);
  }

  // Прокрутка и зум по двойному тапу игре только мешают
  document.addEventListener("touchmove", (e) => e.preventDefault(), { passive: false });

  return {
    enabled: true,

    /** Панель прячется, когда открыта карта или висит экран финала. */
    setVisible(visible) {
      root.classList.toggle("hidden", !visible);
    },
  };
}
