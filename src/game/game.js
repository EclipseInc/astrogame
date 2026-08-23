import * as THREE from "three";
import { CONFIG } from "../config.js";
import { createTerrain, CRATERS } from "../world/terrain.js";
import { createLighting } from "../world/lighting.js";
import {
  createBoulders,
  createCraterSteps,
  createRover,
  createShadowCourse,
  createShadowRidge,
  createStation,
} from "../world/props.js";
import { animateItem, createCanister, createEnergyCell, resetItem } from "../world/items.js";
import { animateFinds, createFinds, resetFinds } from "../world/finds.js";
import { createPlayer } from "../player/player.js";
import { createRoverRig } from "../player/rover.js";
import { createFootprints } from "../fx/footprints.js";
import { createDust } from "../fx/dust.js";

const SPAWN = { x: 15, z: 13 };

// Точки интереса. Расширять сюжет = дописывать сюда, всё остальное автоматически.
const CELL_SPOTS = [
  { x: -27, z: -19, hint: "Ячейка &laquo;A&raquo; — к юго-западу, за валунами." },
  { x: -74, z: 59, hint: "Ячейка &laquo;B&raquo; — на дне большого кратера." },
  { x: -118, z: -78, hint: "Ячейка &laquo;C&raquo; — в теневой зоне, на колоннах." },
];

// Находки стоят в стороне от маршрута: за ними надо специально сходить.
// Рядом с каждой лежит баллон, иначе при таймере в 4 минуты крюк никто не сделает.
const FIND_SPOTS = [
  {
    type: "probe",
    x: 62,
    z: -38,
    near: "<b>Кратер-7:</b> Фиксирую металл к востоку. Не наш.",
    line:
      "<b>Кратер-7:</b> Автоматическая станция, сгорела при посадке. " +
      "В реестре её нет — значит, садилась не по плану.",
  },
  {
    type: "tracks",
    x: -46,
    z: 104,
    near: "<b>Кратер-7:</b> Луми, впереди борозды в реголите. Свежими их не назвать.",
    line:
      "<b>Кратер-7:</b> Следы скафандра. Обрываются на полушаге — " +
      "дальше реголит нетронут. До нас здесь кто-то стоял.",
  },
  {
    type: "meteorite",
    x: -152,
    z: 26,
    near: "<b>Кратер-7:</b> Слева воронка. Совсем свежая.",
    line:
      "<b>Кратер-7:</b> Вот что оборвало связь. Такой камень идёт роем — " +
      "и рой ещё не кончился.",
  },
];

const CANISTER_SPOTS = [
  { x: -12, z: -30 },
  { x: -52, z: 26 },
  { x: -92, z: 34 },
  { x: -74, z: -46 },
  { x: -112, z: -44 },
  // по баллону рядом с каждой находкой: награда за крюк
  ...FIND_SPOTS.map((f) => ({ x: f.x + 4, z: f.z + 4 })),
];

export function createGame({ hud, input, isoCam, minimap, audio }) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  // Тумана нет намеренно: на Луне нет атмосферы, дымка сразу читается как Земля.

  const lighting = createLighting(scene);

  scene.add(createTerrain());
  const station = createStation(scene);
  const roverParts = createRover(scene, 18, 15);
  createCraterSteps(scene);
  createShadowRidge(scene, CELL_SPOTS[2]);

  // Акт 3: колонны в тёмном кратере, ячейка «C» ждёт на последней из них
  const course = createShadowCourse(scene, {
    crater: CRATERS[3],
    target: CELL_SPOTS[2],
    approach: { x: 0, z: 0 }, // игрок приходит со стороны станции
  });

  createBoulders(scene, [
    ...CELL_SPOTS.map((s) => ({ ...s, r: 7 })),
    ...CANISTER_SPOTS.map((s) => ({ ...s, r: 4 })),
    ...course.columns.map((c) => ({ x: c.x, z: c.z, r: 7 })),
    { x: SPAWN.x, z: SPAWN.z, r: 8 },
  ]);

  // Валуны, за которыми лежит первая ячейка — учат поворачивать камеру
  const player = createPlayer(scene, SPAWN);
  const footprints = createFootprints(scene);
  const dust = createDust(scene);

  const rover = createRoverRig(roverParts, scene);
  const finds = createFinds(scene, FIND_SPOTS);
  const cells = CELL_SPOTS.map((s, i) => createEnergyCell(scene, s.x, s.z, i));
  const canisters = CANISTER_SPOTS.map((s) => createCanister(scene, s.x, s.z));

  const state = {
    phase: "play", // play | win | fail
    oxygen: CONFIG.oxygenSeconds,
    delivered: 0,
    carrying: null,
    time: 0,
    winTimer: 0,
    found: 0,
    beats: new Set(),
  };

  const tmp = new THREE.Vector3();

  // Отложенные реплики: при перезапуске их надо снимать, иначе старые
  // подсказки прилетают посреди нового забега.
  const timers = new Set();
  function later(fn, ms) {
    const id = setTimeout(() => {
      timers.delete(id);
      fn();
    }, ms);
    timers.add(id);
  }

  const INTRO = "<b>Кратер-7:</b> Луми, связь с Землёй потеряна. Антенна обесточена.";

  /**
   * Перезапуск забега без пересборки мира: рельеф, камни и станция статичны,
   * меняется только состояние. Отсюда мгновенный рестарт вместо перезагрузки.
   */
  function startRun() {
    for (const id of timers) clearTimeout(id);
    timers.clear();

    state.phase = "play";
    state.oxygen = CONFIG.oxygenSeconds;
    state.delivered = 0;
    state.carrying = null;
    state.time = 0;
    state.winTimer = 0;
    state.found = 0;
    state.beats.clear();
    resetFinds(finds);

    for (const item of [...cells, ...canisters]) resetItem(item, scene);

    for (const socket of station.sockets) {
      socket.filled = false;
      socket.ring.material.emissive.setHex(0x000000);
      socket.ring.material.emissiveIntensity = 0;
    }
    station.dish.rotation.set(Math.PI * 0.72, 0, 0.3);
    lighting.setDawn(0);

    rover.reset(18, 15);
    player.reset(SPAWN);
    footprints.clear();
    dust.clear();
    isoCam.snap(player.position);

    audio.setUrgency(0);
    hud.setCells(0);
    hud.setFinds(0);
    hud.setOxygen(state.oxygen, CONFIG.oxygenSeconds);
    hud.setObjective("Найти энергоячейку");
  }

  /** Кнопка на экране финала: возвращаемся в игру мгновенно. */
  function restart() {
    startRun();
    hud.hideScreen();
    minimap.close();
    say(INTRO, 5);
  }

  startRun();
  // радио здесь не играет: звук ещё не разрешён до жеста пользователя
  hud.say(INTRO, 5);

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

  const distanceTo = (v) =>
    Math.hypot(v.x - player.position.x, v.z - player.position.z);

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

  /**
   * Ячейка едет либо на спине, либо в багажнике ровера. За рулём модель
   * космонавта скрыта, и груз на ней исчез бы вместе с ней.
   */
  function stowCell(cell) {
    const holder = rover.driving ? rover.cargo : player.model.carrySlot;
    holder.add(cell.group);
    cell.group.position.set(0, 0, 0);
    cell.group.rotation.set(0, 0, 0);
  }

  function pickUp(cell) {
    cell.state = "carried";
    stowCell(cell);
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
          later(
            () => say("<b>Кратер-7:</b> Спускайся по уступам. Прыжок здесь длинный — целься по маркеру.", 5),
            5600
          )
        );
      }
      if (state.delivered === 2) {
        beat("dark", () =>
          later(
            () =>
              say(
                "<b>Кратер-7:</b> Там вечная тень. Включи фонарь — <b>F</b>. " +
                  "Дальше только по колоннам: кристаллы покажут следующую.",
                6
              ),
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
    btn.addEventListener("click", restart);
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

      // Починка и посадка: одна клавиша R на оба действия
      if (controllable && input.justPressed("ride")) {
        if (rover.driving) {
          rover.exit(player);
          if (state.carrying) stowCell(state.carrying);
          say("<b>Кратер-7:</b> Ровер заглушен.", 2.5);
        } else if (rover.fixed && distanceTo(rover.position) < CONFIG.roverEnterRadius) {
          rover.enter(player);
          if (state.carrying) stowCell(state.carrying);
          audio.deposit();
        }
      }

      if (rover.driving) {
        // Игрока везёт сам ровер: он ставит его на сиденье и правит поворот
        rover.update(dt, controllable ? input : IDLE_INPUT, isoCam.yaw, player);
        if (rover.speed > 3) dust.burst(rover.position, 2, 0.4);
      } else {
        player.update(dt, controllable ? input : IDLE_INPUT, isoCam.yaw);
      }

      if (player.stepped && !rover.driving) {
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
      animateFinds(finds, state.time);

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

        // Оторванное колесо: подобрал — ровер на ходу
        if (!rover.fixed && distanceTo(rover.spare.position) < CONFIG.pickupRadius) {
          rover.repair();
          audio.deposit();
          beat("roverFixed", () =>
            say(
              "<b>Кратер-7:</b> Колесо на месте, ровер на ходу. Садись — <b>R</b>. " +
                "На уступы и колонны он не заедет, там ногами.",
              6
            )
          );
        }

        // Находки: сначала наводка издалека, потом сама находка вблизи
        for (const find of finds) {
          if (find.found) continue;
          const d = Math.hypot(find.x - player.position.x, find.z - player.position.z);

          if (!find.hinted && d < CONFIG.findHintRadius) {
            find.hinted = true;
            say(find.near, 4);
          }
          if (d < CONFIG.findRadius) {
            find.found = true;
            state.found++;
            hud.setFinds(state.found);
            audio.discovery();
            say(find.line, 7);
          }
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
          btn.addEventListener("click", restart);
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
          finds,
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
