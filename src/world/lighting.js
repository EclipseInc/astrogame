import * as THREE from "three";
import { CONFIG } from "../config.js";

/**
 * На Луне нет атмосферы: один жёсткий источник, почти нулевая заливка,
 * чёрные тени. Всё «атмосферное» здесь делает длина теней, а не цвет.
 */
export function createLighting(scene) {
  // Солнце почти белое: реголит серый, любая теплота сразу читается как земной закат.
  const sun = new THREE.DirectionalLight(0xfffdf7, 3.8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 260;
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.05;

  const cam = sun.shadow.camera;
  // Коробка теней покрывает видимую область с запасом: чем она меньше,
  // тем чётче тень при той же карте теней.
  cam.left = -58;
  cam.right = 58;
  cam.top = 58;
  cam.bottom = -58;
  cam.updateProjectionMatrix();

  scene.add(sun);
  scene.add(sun.target);

  // Отражённый от реголита свет — очень слабый и холодный.
  const bounce = new THREE.HemisphereLight(0x141a22, 0x2b2c2e, 0.5);
  scene.add(bounce);

  const state = {
    sun,
    elevation: CONFIG.sunElevation,
    azimuth: CONFIG.sunAzimuth,

    /** Направление «от сцены к солнцу». */
    direction(out = new THREE.Vector3()) {
      return out
        .set(
          Math.sin(this.azimuth) * Math.cos(this.elevation),
          Math.sin(this.elevation),
          Math.cos(this.azimuth) * Math.cos(this.elevation)
        )
        .normalize();
    },

    /** Тени дорогие — двигаем «коробку» теней вслед за игроком. */
    follow(target) {
      const dir = this.direction();
      sun.target.position.copy(target);
      sun.position.copy(target).addScaledVector(dir, 120);
      sun.target.updateMatrixWorld();
    },

    /** Акт 4: рассвет — солнце поднимается, тени укорачиваются, свет теплеет. */
    setDawn(t) {
      this.elevation = THREE.MathUtils.lerp(CONFIG.sunElevation, 42 * (Math.PI / 180), t);
      // Тени укорачиваются, свет теплеет — рассвет читается за пару секунд.
      sun.color.lerpColors(
        new THREE.Color(0xfffdf7),
        new THREE.Color(0xffdcb8),
        t
      );
      bounce.intensity = 0.5 + t * 0.5;
    },
  };

  return state;
}
