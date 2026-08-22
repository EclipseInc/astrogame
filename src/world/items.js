import * as THREE from "three";
import { surfaceHeightAt } from "./collision.js";

const CELL_COLOR = 0x7fd4c1;
const O2_COLOR = 0xffffff;

/** Энергоячейка: подбираем, несём на спине, вставляем в антенну. */
export function createEnergyCell(scene, x, z, index) {
  const group = new THREE.Group();
  const ground = surfaceHeightAt(x, z);
  group.position.set(x, ground + 0.9, z);

  const core = new THREE.Mesh(
    new THREE.CylinderGeometry(0.34, 0.34, 0.95, 6),
    new THREE.MeshStandardMaterial({
      color: 0x1e2a2a,
      emissive: CELL_COLOR,
      emissiveIntensity: 1.3,
      roughness: 0.3,
      metalness: 0.4,
    })
  );
  core.castShadow = true;
  group.add(core);

  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.42, 0.42, 0.16, 6),
    new THREE.MeshStandardMaterial({ color: 0x9aa1a8, roughness: 0.4, metalness: 0.6 })
  );
  cap.position.y = 0.52;
  group.add(cap);

  const light = new THREE.PointLight(CELL_COLOR, 14, 16, 2);
  light.position.y = 0.4;
  group.add(light);

  scene.add(group);

  return {
    type: "cell",
    index,
    group,
    light,
    home: new THREE.Vector3(x, ground + 0.9, z),
    state: "world", // world | carried | delivered
    phase: index * 1.7,
  };
}

/** Баллон с кислородом: +время. Расставлены по маршруту как «чекпоинты». */
export function createCanister(scene, x, z, bonus = 30) {
  const group = new THREE.Group();
  const ground = surfaceHeightAt(x, z);
  group.position.set(x, ground + 0.6, z);

  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.26, 0.6, 4, 10),
    new THREE.MeshStandardMaterial({
      color: 0xe6e9ec,
      emissive: 0x223344,
      emissiveIntensity: 0.4,
      roughness: 0.5,
      metalness: 0.2,
    })
  );
  body.castShadow = true;
  group.add(body);

  const stripe = new THREE.Mesh(
    new THREE.TorusGeometry(0.27, 0.05, 6, 14),
    new THREE.MeshStandardMaterial({
      color: 0x2a3138,
      emissive: O2_COLOR,
      emissiveIntensity: 0.6,
    })
  );
  stripe.rotation.x = Math.PI / 2;
  group.add(stripe);

  scene.add(group);

  return {
    type: "canister",
    group,
    bonus,
    home: new THREE.Vector3(x, ground + 0.6, z),
    state: "world",
    phase: (x + z) * 0.13,
  };
}

/** Возвращает предмет в мир на исходное место (перезапуск забега). */
export function resetItem(item, scene) {
  if (item.group.parent !== scene) scene.add(item.group);
  item.group.position.copy(item.home);
  item.group.rotation.set(0, 0, 0);
  item.group.visible = true;
  item.state = "world";
  if (item.light) item.light.intensity = 12;
}

/** Покачивание и вращение — предметы должны быть заметны на сером фоне. */
export function animateItem(item, time) {
  if (item.state !== "world") return;
  item.group.rotation.y = time * 0.8 + item.phase;
  item.group.position.y = item.home.y + Math.sin(time * 1.6 + item.phase) * 0.16;
  if (item.light) item.light.intensity = 12 + Math.sin(time * 3 + item.phase) * 3;
}
