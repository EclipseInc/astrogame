import * as THREE from "three";
import { CONFIG } from "../config.js";
import { groundHeightAt, resolveHorizontal } from "../world/collision.js";
import { terrainNormal } from "../world/terrain.js";

const ROVER_RADIUS = 1.7;
const up = new THREE.Vector3(0, 1, 0);

/**
 * Транспорт. Ровер вдвое быстрее пешего хода, но не прыгает — в кратер по
 * уступам и на колонны в теневой зоне придётся идти ногами. Так он ускоряет
 * перегоны, не обесценивая платформинг.
 */
export function createRoverRig(parts, scene) {
  const { group, wheels, socket, cargo, spare, platform } = parts;

  const baseRadius = platform.r;

  const state = {
    fixed: false,
    driving: false,
    speed: 0,
    heading: group.rotation.y,
    wheelSpin: 0,
  };

  const forward = new THREE.Vector3();
  const right = new THREE.Vector3();
  const wish = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const tilt = new THREE.Quaternion();
  const yawQuat = new THREE.Quaternion();
  // Космонавт не прячется внутрь: лунный ровер открытый, водителя видно
  const SEAT = new THREE.Vector3(-0.5, 1.35, 0);
  const seat = new THREE.Vector3();

  const api = {
    group,
    spare,
    cargo,

    get fixed() {
      return state.fixed;
    },
    get driving() {
      return state.driving;
    },
    get speed() {
      return Math.abs(state.speed);
    },
    get position() {
      return group.position;
    },

    /** Ставим найденное колесо на место: ровер выпрямляется и заводится. */
    repair() {
      if (state.fixed) return false;
      state.fixed = true;

      // Поехавший ровер перестаёт быть препятствием, иначе он столкнётся
      // сам с собой: платформа осталась бы стоять на старом месте.
      platform.r = 0;

      spare.parent?.remove(spare);
      spare.position.copy(socket.position);
      spare.rotation.set(Math.PI / 2, 0, 0);
      group.add(spare);
      wheels.push(spare);

      state.heading = group.rotation.y;
      group.rotation.set(0, state.heading, 0);
      group.position.y = groundHeightAt(group.position.x, group.position.z);
      return true;
    },

    enter(player) {
      if (!state.fixed || state.driving) return false;
      state.driving = true;
      player.marker.visible = false; // маркер приземления за рулём не нужен
      return true;
    },

    /** Высаживаем сбоку, чтобы игрок не оказался внутри корпуса. */
    exit(player) {
      if (!state.driving) return false;
      state.driving = false;
      state.speed = 0;

      const side = new THREE.Vector3(Math.cos(state.heading), 0, -Math.sin(state.heading));
      const x = group.position.x + side.x * 2.6;
      const z = group.position.z + side.z * 2.6;

      player.marker.visible = true;
      player.position.set(x, groundHeightAt(x, z) + 0.2, z);
      player.velocity.set(0, 0, 0);
      return true;
    },

    update(dt, input, camYaw, player) {
      if (!state.driving) return;

      forward.set(-Math.sin(camYaw), 0, -Math.cos(camYaw));
      right.set(-forward.z, 0, forward.x);

      wish.set(0, 0, 0);
      wish.addScaledVector(forward, input.moveZ);
      wish.addScaledVector(right, input.moveX);

      if (wish.lengthSq() > 0.01) {
        wish.normalize();
        // Ровер доворачивает к направлению, а не мгновенно едет туда:
        // это и отличает машину от пешехода
        const target = Math.atan2(wish.x, wish.z);
        let diff = target - state.heading;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        state.heading += diff * Math.min(1, dt * CONFIG.roverTurn);

        // На крутом довороте скорость падает — иначе занос выглядит нелепо
        const align = Math.max(0.25, 1 - Math.abs(diff) / Math.PI);
        state.speed = THREE.MathUtils.damp(
          state.speed,
          CONFIG.roverSpeed * align,
          CONFIG.roverAccel,
          dt
        );
      } else {
        state.speed = THREE.MathUtils.damp(state.speed, 0, CONFIG.roverBrake, dt);
      }

      group.position.x += Math.sin(state.heading) * state.speed * dt;
      group.position.z += Math.cos(state.heading) * state.speed * dt;
      resolveHorizontal(group.position, ROVER_RADIUS);

      const limit = CONFIG.worldSize / 2 - 6;
      group.position.x = THREE.MathUtils.clamp(group.position.x, -limit, limit);
      group.position.z = THREE.MathUtils.clamp(group.position.z, -limit, limit);

      // Сидим на грунте и повторяем его наклон
      group.position.y = groundHeightAt(group.position.x, group.position.z, Infinity);
      terrainNormal(group.position.x, group.position.z, normal);
      tilt.setFromUnitVectors(up, normal);
      yawQuat.setFromAxisAngle(up, state.heading);
      group.quaternion.copy(tilt).multiply(yawQuat);

      state.wheelSpin += (state.speed / 0.62) * dt;
      for (const w of wheels) w.rotation.y = state.wheelSpin;

      // Сажаем водителя на площадку ровера, а не телепортируем в его центр:
      // так работают и подбор предметов, и камера, и фонарь
      if (player) {
        seat.copy(SEAT).applyQuaternion(group.quaternion).add(group.position);
        player.model.root.position.copy(seat);
        player.model.body.rotation.y = state.heading;
        player.facing = state.heading;
      }
    },

    reset(x, z) {
      state.driving = false;
      state.fixed = false;
      state.speed = 0;
      state.wheelSpin = 0;

      const i = wheels.indexOf(spare);
      if (i >= 0) wheels.splice(i, 1);
      group.remove(spare);
      scene.add(spare);
      spare.position.set(x + 5.4, groundHeightAt(x + 5.4, z + 3.2) + 0.2, z + 3.2);
      spare.rotation.set(0.2, 0, 1.2);

      group.position.set(x, groundHeightAt(x, z), z);
      group.rotation.set(0.16, 0.9, -0.28);
      group.quaternion.setFromEuler(group.rotation);
      state.heading = 0.9;

      // Снова препятствие на исходном месте
      platform.x = x;
      platform.z = z;
      platform.r = baseRadius;
    },
  };

  return api;
}
