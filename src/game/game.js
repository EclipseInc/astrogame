import * as THREE from "three";
import { CONFIG } from "../config.js";
import { createTerrain } from "../world/terrain.js";
import { createLighting } from "../world/lighting.js";
import {
  createBoulders,
  createCraterSteps,
  createRover,
  createShadowRidge,
  createStation,
} from "../world/props.js";
import { animateItem, createCanister, createEnergyCell } from "../world/items.js";
import { createPlayer } from "../player/player.js";
import { createFootprints } from "../fx/footprints.js";
import { createDust } from "../fx/dust.js";

const SPAWN = { x: 15, z: 13 };

// Точки интереса. Расширять сюжет = дописывать сюда, всё остальное автоматически.
const CELL_SPOTS = [
  { x: -27, z: -19, hint: "Ячейка &laquo;A&raquo; — к юго-западу, за валунами." },
  { x: -74, z: 59, hint: "Ячейка &laquo;B&raquo; — на дне большого кратера." },
  { x: -118, z: -78, hint: "Ячейка &laquo;C&raquo; — в теневой зоне за грядой." },
];

const CANISTER_SPOTS = [
  { x: -12, z: -30 },
  { x: -52, z: 26 },
  { x: -92, z: 34 },
  { x: -74, z: -46 },
  { x: -112, z: -44 },
];

export function createGame({ hud, input, isoCam, minimap, audio }) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  // Тумана нет намеренно: на Луне нет атмосферы, дымка сразу читается как Земля.

  const lighting = createLighting(scene);

  scene.add(createTerrain());
  const station = createStation(scene);
  createRover(scene, 18, 15);
  createCraterSteps(scene);
  createShadowRidge(scene, CELL_SPOTS[2]);
  createBoulders(scene, [
    ...CELL_SPOTS.map((s) => ({ ...s, r: 7 })),
    ...CANISTER_SPOTS.map((s) => ({ ...s, r: 4 })),
    { x: SPAWN.x, z: SPAWN.z, r: 8 },
  ]);

  // Валуны, за которыми лежит первая ячейка — учат поворачивать камеру
  const player = createPlayer(scene, SPAWN);
  const footprints = createFootprints(scene);
  const dust = createDust(scene);

  const cells = CELL_SPOTS.map((s, i) => createEnergyCell(scene, s.x, s.z, i));
  const canisters = CANISTER_SPOTS.map((s) => createCanister(scene, s.x, s.z));

  const state = {
    phase: "play", // play | win | fail
    oxygen: CONFIG.oxygenSeconds,
    delivered: 0,
    carrying: null,
    time: 0,
    winTimer: 0,
    beats: new Set(),
  };

  isoCam.snap(player.position);
  hud.setCells(0);
  hud.setOxygen(state.oxygen, CONFIG.oxygenSeconds);
  hud.setObjective("Найти энергоячейку");
  hud.say("<b>Кратер-7:</b> Луми, связь с Землёй потеряна. Антенна обесточена.", 5);
  // радио здесь не играет: звук ещё не разрешён до жеста пользователя

  const tmp = new THREE.Vector3();

  /** Реплика станции: сначала несущая, потом текст. */
  function say(text, seconds) {
    audio.radio();
    hud.say(text, seconds);
  }

  function beat(id, fn) {
    if (state.beats.has(id)) return;
    state.beats.add(id);
    fn();
  }

  function nearest(list, radius) {
    let best = null;
    let bestD = radius;
    for (const item of list) {
      if (item.state !== "world") continue;
      const d = item.group.position.distanceTo(player.position);
      if (d < bestD) {
        bestD = d;
        best = item;
      }
    }
    return best;
  }

  function pickUp(cell) {
    cell.state = "carried";
    player.model.carrySlot.add(cell.group);
    cell.group.position.set(0, 0, 0);
    cell.group.rotation.set(0, 0, 0);
    hud.setObjective("Доставить ячейку к антенне");
    audio.pickup();
    say("<b>Кратер-7:</b> Ячейка у тебя. Неси её к антенне.", 4);
  }

  function deposit() {
    const cell = state.carrying;
    const socket = station.sockets.find((s) => !s.filled);
    socket.filled = true;
    socket.ring.material.emissive.setHex(0x7fd4c1);
    socket.ring.material.emissiveIntensity = 2;

    scene.add(cell.group);
    socket.group.getWorldPosition(tmp);
    cell.group.position.copy(tmp).setY(tmp.y + 1.0);
    cell.group.rotation.set(0, 0, 0);
    cell.state = "delivered";
    cell.light.intensity = 6;

    state.carrying = null;
    state.delivered++;
    hud.setCells(state.delivered);
    audio.deposit();

    if (state.delivered >= 3) {
      startWin();
    } else {
      const next = CELL_SPOTS[state.delivered];
      hud.setObjective("Найти энергоячейку");
      say(`<b>Кратер-7:</b> Есть контакт. ${next.hint}`, 5.5);
      if (state.delivered === 1) {
        beat("crater", () =>
          setTimeout(
            () => say("<b>Кратер-7:</b> Спускайся по уступам. Прыжок здесь длинный — целься по маркеру.", 5),
            5600
          )
        );
      }
      if (state.delivered === 2) {
        beat("dark", () =>
          setTimeout(
            () => say("<b>Кратер-7:</b> Там вечная тень. Включи фонарь — <b>F</b>.", 5),
            5600
          )
        );
      }
    }
  }

  function startWin() {
    state.phase = "win";
    state.winTimer = 0;
    hud.setObjective("Связь восстановлена");
    audio.win();
    say("<b>Кратер-7:</b> Питание есть. Разворачиваю антенну…", 6);
  }

  function fail() {
    state.phase = "fail";
    audio.fail();
    const btn = hud.showScreen({
      title: "КИСЛОРОД ИСЧЕРПАН",
      sub: "связь не восстановлена",
      body: "Луми не успел вернуться к антенне. Кратер-7 остался молчать.",
      button: "ПОПРОБОВАТЬ СНОВА",
      variant: "fail",
    });
    btn.addEventListener("click", () => location.reload());
  }

  return {
    scene,
    player,
    lighting,

    update(dt) {
      state.time += dt;
      hud.tick(dt);

      // Дыхание учащается по мере расхода кислорода, пульс включается под конец
      audio.setUrgency(1 - state.oxygen / CONFIG.oxygenSeconds);
      audio.update(dt);

      if (state.phase === "play") {
        state.oxygen -= dt;
        hud.setOxygen(state.oxygen, CONFIG.oxygenSeconds);
        if (state.oxygen <= 0) {
          fail();
          return;
        }
        if (state.oxygen < CONFIG.oxygenLowAt) {
          beat("low", () =>
            (audio.warning(),
            say("<b>Кратер-7:</b> Минута кислорода. Ищи баллоны — они помечены белым.", 5))
          );
        }
      }

      // Карта: пока открыта, космонавт стоит на месте — но кислород идёт,
      // так что бесконечно изучать её не выйдет.
      if (input.justPressed("map")) minimap.toggle();
      if (minimap.open && input.justPressed("cancel")) minimap.close();

      // Камера и фонарь работают всегда, даже в финальной сцене
      if (input.justPressed("rotateLeft")) isoCam.rotate(-1);
      if (input.justPressed("rotateRight")) isoCam.rotate(1);
      if (input.justPressed("torch")) player.toggleTorch();

      const controllable = state.phase === "play" && !minimap.open;
      player.update(dt, controllable ? input : IDLE_INPUT, isoCam.yaw);

      if (player.stepped) {
        footprints.step(player.position, player.facing);
        dust.burst(player.position, 3, 0.35);
        audio.step();
      }
      if (player.justJumped) audio.jump();
      if (player.justLanded && player.landingSpeed > 1.5) {
        dust.burst(player.position, 14, Math.min(1.6, player.landingSpeed * 0.22));
        audio.land(player.landingSpeed * 0.28);
      }
      dust.update(dt);

      for (const item of [...cells, ...canisters]) animateItem(item, state.time);

      if (controllable) {
        if (!state.carrying) {
          const cell = nearest(cells, CONFIG.pickupRadius);
          if (cell) {
            state.carrying = cell;
            pickUp(cell);
            beat("firstPickup", () => {});
          }
        } else if (player.position.distanceTo(station.group.position) < CONFIG.depositRadius) {
          deposit();
        }

        const can = nearest(canisters, CONFIG.pickupRadius);
        if (can) {
          can.state = "used";
          can.group.visible = false;
          state.oxygen = Math.min(CONFIG.oxygenSeconds, state.oxygen + can.bonus);
          audio.canister();
          hud.say(`<b>+${can.bonus} сек кислорода</b>`, 2.5);
        }

        // Подсказки первых секунд — обучение без отдельного туториала
        if (state.time > 4 && state.delivered === 0 && !state.carrying) {
          beat("intro2", () =>
            say(
              "<b>Кратер-7:</b> Тяготение здесь слабое — прыгай смело. " + CELL_SPOTS[0].hint,
              6
            )
          );
        }
        if (state.time > 12) {
          beat("camHint", () =>
            say("Камеру можно повернуть на <b>Q</b> / <b>E</b>, если что-то заслоняет обзор.", 5)
          );
        }
      }

      if (state.phase === "win") {
        state.winTimer += dt;
        const t = Math.min(1, state.winTimer / 6);
        lighting.setDawn(t);
        // Тарелка разворачивается вогнутой стороной вверх — «ищет» Землю
        station.dish.rotation.x = THREE.MathUtils.lerp(Math.PI * 0.72, Math.PI * 0.97, t);
        station.dish.rotation.y += dt * 0.7;

        if (state.winTimer > 6.5) {
          state.phase = "done";
          const btn = hud.showScreen({
            title: "СИГНАЛ ПРИНЯТ",
            sub: "восход над кратером-7",
            body: `«Кратер-7, мы вас слышим». Луми смотрит, как линия света ползёт по реголиту.<br><br>Кислорода осталось: <b>${Math.floor(state.oxygen)} сек</b>.`,
            button: "ПРОЙТИ СНОВА",
            variant: "win",
          });
          btn.addEventListener("click", () => location.reload());
        }
      }

      if (minimap.open) {
        minimap.draw({
          position: player.position,
          facing: player.facing,
          // Пеленг: пока ячейка не найдена — на неё, когда несём — на антенну
          target: state.carrying
            ? { x: 0, z: 0 }
            : CELL_SPOTS[state.delivered] ?? null,
          time: state.time,
        });
      }

      lighting.follow(player.position);
      isoCam.update(dt, player.position);
    },
  };
}

const IDLE_INPUT = {
  moveX: 0,
  moveZ: 0,
  jumpHeld: false,
  justPressed: () => false,
};
