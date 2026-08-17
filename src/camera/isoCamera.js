import * as THREE from "three";
import { CONFIG } from "../config.js";

const YAWS = [45, 135, 225, 315].map((d) => (d * Math.PI) / 180);

/**
 * Изометрия с четырьмя фиксированными углами. Поворот на Q/E — не украшение,
 * а обязательная механика: без него в изометрии постоянно что-то заслоняет обзор.
 */
export function createIsoCamera(aspect) {
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -400, 800);

  let index = 0;
  let yaw = YAWS[0];
  let fromYaw = yaw;
  let toYaw = yaw;
  let t = 1;

  const focus = new THREE.Vector3();
  const desired = new THREE.Vector3();
  const offset = new THREE.Vector3();

  function applyAspect(a) {
    const v = CONFIG.camViewSize;
    camera.left = -v * a;
    camera.right = v * a;
    camera.top = v;
    camera.bottom = -v;
    camera.updateProjectionMatrix();
  }
  applyAspect(aspect);

  return {
    camera,

    get yaw() {
      return yaw;
    },

    resize(a) {
      applyAspect(a);
    },

    rotate(dir) {
      index = (index + dir + 4) % 4;
      fromYaw = yaw;
      // Идём кратчайшим путём, чтобы не крутануло на 270°
      let target = YAWS[index];
      while (target - fromYaw > Math.PI) target -= Math.PI * 2;
      while (target - fromYaw < -Math.PI) target += Math.PI * 2;
      toYaw = target;
      t = 0;
    },

    /** Мгновенно поставить камеру на цель — для старта и респауна. */
    snap(target) {
      focus.copy(target).add(new THREE.Vector3(0, 1.2, 0));
      place();
    },

    update(dt, target) {
      if (t < 1) {
        t = Math.min(1, t + dt / CONFIG.camRotateTime);
        // easeInOutCubic — поворот без рывка на старте и в конце
        const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        yaw = THREE.MathUtils.lerp(fromYaw, toYaw, e);
      }

      desired.copy(target);
      desired.y += 1.2;
      focus.x = THREE.MathUtils.damp(focus.x, desired.x, CONFIG.camFollowLag, dt);
      focus.z = THREE.MathUtils.damp(focus.z, desired.z, CONFIG.camFollowLag, dt);
      // По вертикали догоняем мягче: иначе камера «прыгает» вместе с игроком
      focus.y = THREE.MathUtils.damp(focus.y, desired.y, CONFIG.camFollowLag * 0.45, dt);

      place();
    },
  };

  function place() {
    const el = CONFIG.camElevation;
    offset.set(
      Math.sin(yaw) * Math.cos(el),
      Math.sin(el),
      Math.cos(yaw) * Math.cos(el)
    );
    camera.position.copy(focus).addScaledVector(offset, CONFIG.camDistance);
    camera.lookAt(focus);
  }
}
