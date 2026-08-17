import * as THREE from "three";
import { CONFIG } from "../config.js";
import { surfaceHeightAt } from "../world/collision.js";

/**
 * Пыль из-под ног. Воздуха нет — частицы летят строго по баллистике
 * и падают без «зависания». Это одна из немногих вещей, которые сразу
 * читаются как «это Луна, а не Земля».
 */
export function createDust(scene, max = 400) {
  const positions = new Float32Array(max * 3);
  const velocities = new Float32Array(max * 3);
  const life = new Float32Array(max);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));

  const mat = new THREE.PointsMaterial({
    color: 0xb5b1a8,
    size: 0.09,
    transparent: true,
    opacity: 0.75,
    depthWrite: false,
  });

  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  scene.add(points);

  let cursor = 0;

  // Все частицы стартуют «мёртвыми» и спрятаны далеко внизу
  for (let i = 0; i < max; i++) positions[i * 3 + 1] = -9999;

  return {
    points,
    burst(origin, count, power = 1) {
      for (let i = 0; i < count; i++) {
        const idx = cursor;
        cursor = (cursor + 1) % max;

        const a = Math.random() * Math.PI * 2;
        const s = (0.6 + Math.random() * 1.6) * power;

        positions[idx * 3 + 0] = origin.x + Math.cos(a) * 0.2;
        positions[idx * 3 + 1] = origin.y + 0.05;
        positions[idx * 3 + 2] = origin.z + Math.sin(a) * 0.2;

        velocities[idx * 3 + 0] = Math.cos(a) * s;
        velocities[idx * 3 + 1] = (0.5 + Math.random() * 1.4) * power;
        velocities[idx * 3 + 2] = Math.sin(a) * s;

        life[idx] = 1;
      }
      geo.attributes.position.needsUpdate = true;
    },

    update(dt) {
      let dirty = false;
      for (let i = 0; i < max; i++) {
        if (life[i] <= 0) continue;
        dirty = true;

        velocities[i * 3 + 1] -= CONFIG.gravity * dt;
        positions[i * 3 + 0] += velocities[i * 3 + 0] * dt;
        positions[i * 3 + 1] += velocities[i * 3 + 1] * dt;
        positions[i * 3 + 2] += velocities[i * 3 + 2] * dt;

        const ground = surfaceHeightAt(positions[i * 3 + 0], positions[i * 3 + 2]);
        if (positions[i * 3 + 1] <= ground) {
          life[i] = 0;
          positions[i * 3 + 1] = -9999;
        }
      }
      if (dirty) geo.attributes.position.needsUpdate = true;
    },
  };
}
