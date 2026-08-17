import * as THREE from "three";
import { CONFIG } from "../config.js";
import { groundHeightAt, resolveHorizontal, surfaceHeightAt } from "../world/collision.js";
import { terrainNormal } from "../world/terrain.js";

const PLAYER_RADIUS = 0.45;

const suitMat = new THREE.MeshStandardMaterial({
  color: 0xe8eaec,
  roughness: 0.65,
  metalness: 0.05,
});
const trimMat = new THREE.MeshStandardMaterial({
  color: 0xe8703a,
  roughness: 0.6,
});
const darkMat = new THREE.MeshStandardMaterial({
  color: 0x22262b,
  roughness: 0.5,
  metalness: 0.3,
});
const visorMat = new THREE.MeshStandardMaterial({
  color: 0x0b1118,
  roughness: 0.08,
  metalness: 0.95,
  // Солнце низкое, половина шлема всегда в тени. Без собственного свечения
  // визор сливается с этой тенью и лицо перестаёт читаться.
  emissive: 0x14405e,
  emissiveIntensity: 1.1,
});

const silMat = new THREE.MeshBasicMaterial({
  color: 0x7fd4c1,
  depthTest: false,
  depthWrite: false,
});

/**
 * Вешает силуэт прямо на деталь тела: уменьшенная копия той же геометрии,
 * ребёнок того же узла. Так силуэт качается вместе с ногой и никогда не
 * торчит там, где тела нет (раньше сплошная капсула светилась между ног).
 */
function addSilhouette(mesh, shrink = 0.86) {
  const ghost = new THREE.Mesh(mesh.geometry, silMat);
  ghost.scale.setScalar(shrink);
  ghost.renderOrder = 5;
  mesh.renderOrder = 6;
  mesh.add(ghost);
  return ghost;
}

function buildAstronaut() {
  const root = new THREE.Group();
  const body = new THREE.Group(); // всё, что поворачивается по движению
  root.add(body);

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.42, 6, 12), suitMat);
  torso.position.y = 1.0;
  torso.castShadow = true;
  body.add(torso);
  addSilhouette(torso);

  const belt = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.06, 6, 16), trimMat);
  belt.position.y = 0.78;
  belt.rotation.x = Math.PI / 2;
  body.add(belt);

  const backpack = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.62, 0.3), darkMat);
  backpack.position.set(0, 1.05, -0.36);
  backpack.castShadow = true;
  body.add(backpack);

  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.33, 20, 16), suitMat);
  helmet.position.y = 1.52;
  helmet.castShadow = true;
  body.add(helmet);
  addSilhouette(helmet, 0.82);

  // В SphereGeometry ось +Z (перёд модели) соответствует phi = PI/2, а не 0.
  // Именно из-за этого визор раньше уезжал на висок и голова читалась криво.
  const VISOR_HALF = 0.95;
  const visor = new THREE.Mesh(
    new THREE.SphereGeometry(
      0.338,
      24,
      18,
      Math.PI / 2 - VISOR_HALF,
      VISOR_HALF * 2,
      0.95,
      0.95
    ),
    visorMat
  );
  visor.position.y = 1.52;
  visor.renderOrder = 6;
  body.add(visor);

  const legs = [];
  const arms = [];
  for (const side of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(side * 0.16, 0.72, 0);
    const legMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.4, 4, 8), suitMat);
    legMesh.position.y = -0.32;
    legMesh.castShadow = true;
    leg.add(legMesh);
    addSilhouette(legMesh, 0.8);
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.14, 0.32), darkMat);
    boot.position.set(0, -0.62, 0.04);
    leg.add(boot);
    body.add(leg);
    legs.push(leg);

    const arm = new THREE.Group();
    arm.position.set(side * 0.38, 1.22, 0);
    const armMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.34, 4, 8), suitMat);
    armMesh.position.y = -0.26;
    armMesh.castShadow = true;
    arm.add(armMesh);
    addSilhouette(armMesh, 0.75);
    const glove = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), trimMat);
    glove.position.y = -0.48;
    arm.add(glove);
    body.add(arm);
    arms.push(arm);
  }

  // Куда «садится» энергоячейка, когда её несут
  const carrySlot = new THREE.Object3D();
  carrySlot.position.set(0, 1.05, -0.62);
  body.add(carrySlot);

  // Силуэт уже висит на каждой детали (см. addSilhouette). Остальным мешам
  // тоже поднимаем renderOrder, чтобы они рисовались поверх своих призраков.
  body.traverse((o) => {
    if (o.isMesh && o.material !== silMat) o.renderOrder = 6;
  });

  return { root, body, legs, arms, carrySlot, helmet };
}

function buildMarker() {
  const group = new THREE.Group();

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.5, 0.62, 28),
    new THREE.MeshBasicMaterial({
      color: 0x7fd4c1,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
  );
  ring.rotation.x = -Math.PI / 2;
  group.add(ring);

  const dot = new THREE.Mesh(
    new THREE.CircleGeometry(0.09, 12),
    new THREE.MeshBasicMaterial({
      color: 0x7fd4c1,
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
    })
  );
  dot.rotation.x = -Math.PI / 2;
  group.add(dot);

  group.renderOrder = 2;
  return group;
}

export function createPlayer(scene, spawn) {
  const model = buildAstronaut();
  const root = model.root;
  root.position.set(spawn.x, groundHeightAt(spawn.x, spawn.z), spawn.z);
  scene.add(root);

  const marker = buildMarker();
  scene.add(marker);

  // Фонарь: в акте 3 это единственный источник света
  const torch = new THREE.SpotLight(0xdfeaff, 0, 26, 0.55, 0.45, 1.2);
  torch.position.set(0, 1.5, 0);
  const torchTarget = new THREE.Object3D();
  torchTarget.position.set(0, 0.6, 4);
  model.body.add(torch);
  model.body.add(torchTarget);
  torch.target = torchTarget;

  const velocity = new THREE.Vector3();
  const forward = new THREE.Vector3();
  const right = new THREE.Vector3();
  const wish = new THREE.Vector3();
  const normal = new THREE.Vector3();

  const player = {
    root,
    model,
    marker,
    torch,
    velocity,
    grounded: true,
    facing: 0,
    walkPhase: 0,
    airBlend: 0,
    animSpeed: 0,
    torchOn: false,
    coyote: 0,
    buffer: 0,
    justLanded: false,
    landingSpeed: 0,
    stepped: false, // флаг для системы следов

    get position() {
      return root.position;
    },

    toggleTorch() {
      player.torchOn = !player.torchOn;
      torch.intensity = player.torchOn ? 90 : 0;
    },

    update(dt, input, camYaw) {
      const wasGrounded = player.grounded;
      player.justLanded = false;
      player.stepped = false;

      // Направления относительно текущего угла камеры
      forward.set(-Math.sin(camYaw), 0, -Math.cos(camYaw));
      right.set(-forward.z, 0, forward.x);

      wish.set(0, 0, 0);
      wish.addScaledVector(forward, input.moveZ);
      wish.addScaledVector(right, input.moveX);
      if (wish.lengthSq() > 1) wish.normalize();

      const accel = CONFIG.groundAccel * (player.grounded ? 1 : CONFIG.airControl);
      const targetVX = wish.x * CONFIG.moveSpeed;
      const targetVZ = wish.z * CONFIG.moveSpeed;
      velocity.x = THREE.MathUtils.damp(velocity.x, targetVX, accel * 0.35, dt);
      velocity.z = THREE.MathUtils.damp(velocity.z, targetVZ, accel * 0.35, dt);

      // Прыжок с «койот-таймом» и буфером нажатия
      player.coyote = player.grounded ? CONFIG.coyoteTime : Math.max(0, player.coyote - dt);
      if (input.justPressed("jump")) player.buffer = CONFIG.jumpBuffer;
      else player.buffer = Math.max(0, player.buffer - dt);

      if (player.buffer > 0 && player.coyote > 0) {
        velocity.y = CONFIG.jumpSpeed;
        player.buffer = 0;
        player.coyote = 0;
        player.grounded = false;
      }

      // Отпустил Space на подъёме — прыжок короче (переменная высота)
      if (velocity.y > 0 && !input.jumpHeld) velocity.y -= CONFIG.gravity * 1.6 * dt;

      velocity.y -= CONFIG.gravity * dt;

      root.position.x += velocity.x * dt;
      root.position.z += velocity.z * dt;
      resolveHorizontal(root.position, PLAYER_RADIUS);

      const prevY = root.position.y;
      root.position.y += velocity.y * dt;

      const ground = groundHeightAt(root.position.x, root.position.z, Math.max(prevY, root.position.y));
      if (root.position.y <= ground) {
        root.position.y = ground;
        if (!wasGrounded) {
          player.justLanded = true;
          player.landingSpeed = -velocity.y;
        }
        velocity.y = 0;
        player.grounded = true;
      } else {
        player.grounded = false;
      }

      // Границы мира
      const limit = CONFIG.worldSize / 2 - 6;
      root.position.x = THREE.MathUtils.clamp(root.position.x, -limit, limit);
      root.position.z = THREE.MathUtils.clamp(root.position.z, -limit, limit);

      // Поворот модели по направлению движения
      const speed = Math.hypot(velocity.x, velocity.z);
      if (speed > 0.35) {
        const target = Math.atan2(velocity.x, velocity.z);
        let diff = target - player.facing;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        player.facing += diff * Math.min(1, dt * 12);
      }
      model.body.rotation.y = player.facing;

      animate(model, player, dt, speed);
      updateMarker(marker, root.position, player.grounded, normal);

      return player;
    },
  };

  return player;
}

// Длина полушага в метрах: фаза шага привязана к пройденному пути, а не ко
// времени. Иначе при просадке кадров или скачке скорости ноги «телепортируются».
const STRIDE = 1.15;

// Поза в полёте: [нога0, нога1, рука0, рука1]
const AIR_POSE = [-0.5, -0.2, -0.9, -0.9];

function animate(model, player, dt, speed) {
  // Плавный переход земля ↔ воздух. Раньше позы переключались мгновенно, и на
  // каждой кочке (grounded скакал через кадр) ноги дёргались.
  player.airBlend = THREE.MathUtils.damp(player.airBlend, player.grounded ? 0 : 1, 9, dt);

  // Сглаженная скорость: мгновенная скачет при столкновениях со склоном
  player.animSpeed = THREE.MathUtils.damp(player.animSpeed, speed, 10, dt);

  const prev = player.walkPhase;
  if (player.grounded) player.walkPhase += (speed * dt * Math.PI) / STRIDE;

  const amp = Math.min(0.62, player.animSpeed * 0.13);
  const swing = Math.sin(player.walkPhase) * amp;
  const ground = [swing, -swing, -swing * 0.7, swing * 0.7];

  const parts = [model.legs[0], model.legs[1], model.arms[0], model.arms[1]];
  for (let i = 0; i < parts.length; i++) {
    parts[i].rotation.x = THREE.MathUtils.lerp(ground[i], AIR_POSE[i], player.airBlend);
  }

  // Шаг — на переходе через кратную PI фазу: сюда вешаются следы и пыль
  if (
    player.grounded &&
    player.airBlend < 0.4 &&
    speed > 0.6 &&
    Math.floor(prev / Math.PI) !== Math.floor(player.walkPhase / Math.PI)
  ) {
    player.stepped = true;
  }

  const bob = Math.abs(Math.sin(player.walkPhase)) * 0.04 * Math.min(1, player.animSpeed);
  model.body.position.y = bob * (1 - player.airBlend);
}

const up = new THREE.Vector3(0, 1, 0);

function updateMarker(marker, pos, grounded, normal) {
  const h = surfaceHeightAt(pos.x, pos.z);
  marker.position.set(pos.x, h + 0.06, pos.z);

  terrainNormal(pos.x, pos.z, normal);
  marker.quaternion.setFromUnitVectors(up, normal);

  // На земле маркер почти не виден, в полёте — подсказка, куда падаешь
  const targetOpacity = grounded ? 0.18 : 0.75;
  for (const child of marker.children) {
    child.material.opacity = THREE.MathUtils.lerp(
      child.material.opacity,
      targetOpacity,
      0.2
    );
  }
  const scale = grounded ? 1 : 1.25;
  marker.scale.setScalar(THREE.MathUtils.lerp(marker.scale.x, scale, 0.2));
}
