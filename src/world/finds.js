import * as THREE from "three";
import { mulberry32 } from "../core/noise.js";
import { terrainHeight } from "./terrain.js";
import { addPlatform } from "./collision.js";

/**
 * Находки: то, ради чего стоит сойти с маршрута. Прохождению не нужны,
 * но каждая даёт кусок лора и стоит рядом с баллоном кислорода — крюк
 * окупается, иначе при таймере в четыре минуты его никто не сделает.
 */

const wreckMat = new THREE.MeshStandardMaterial({
  color: 0x8a8578,
  roughness: 0.85,
  metalness: 0.35,
  flatShading: true,
});

const burntMat = new THREE.MeshStandardMaterial({
  color: 0x2b2723,
  roughness: 0.95,
  metalness: 0.2,
  flatShading: true,
});

const glassMat = new THREE.MeshStandardMaterial({
  color: 0x1a2b33,
  roughness: 0.2,
  metalness: 0.8,
  emissive: 0xe8703a,
  emissiveIntensity: 0.9,
});

const dustMat = new THREE.MeshBasicMaterial({
  color: 0x39352f,
  transparent: true,
  opacity: 0.5,
  depthWrite: false,
});

/** Обломок автоматической станции: тарелка, ноги, обгоревший корпус. */
function buildProbeWreck(rand) {
  const g = new THREE.Group();

  const body = new THREE.Mesh(new THREE.OctahedronGeometry(0.8, 0), burntMat);
  body.scale.set(1, 0.7, 1);
  body.position.y = 0.6;
  body.rotation.y = 0.4;
  body.castShadow = true;
  g.add(body);

  // Тарелка смята и уткнулась в грунт
  const dish = new THREE.Mesh(
    new THREE.SphereGeometry(1.1, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.45),
    wreckMat
  );
  dish.material.side = THREE.DoubleSide;
  dish.position.set(1.3, 0.45, -0.6);
  dish.rotation.set(Math.PI * 0.62, 0, 0.9);
  dish.castShadow = true;
  g.add(dish);

  // Посадочные опоры: одна подломлена
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.7;
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.1, 6), wreckMat);
    leg.position.set(Math.cos(a) * 0.62, 0.32, Math.sin(a) * 0.62);
    leg.rotation.set(Math.cos(a) * 0.55, 0, -Math.sin(a) * 0.55);
    if (i === 1) leg.rotation.z += 1.1; // подломленная
    leg.castShadow = true;
    g.add(leg);
  }

  // Единственный уцелевший индикатор — он и выдаёт обломок в темноте
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), glassMat);
  lamp.position.set(-0.3, 1.05, 0.35);
  g.add(lamp);

  return { group: g, blink: lamp, radius: 1.6 };
}

/** Следы предыдущей экспедиции, обрывающиеся на полушаге. */
function buildOldTracks(rand) {
  const g = new THREE.Group();

  const step = new THREE.PlaneGeometry(0.3, 0.42);
  step.rotateX(-Math.PI / 2);
  for (let i = 0; i < 14; i++) {
    const m = new THREE.Mesh(step, dustMat);
    m.position.set((i % 2 ? 0.2 : -0.2) + i * 0.05, 0.03, i * 0.75 - 5);
    m.rotation.y = 0.2;
    g.add(m);
  }

  // Опрокинутая веха с выцветшим вымпелом
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.7, 6), wreckMat);
  pole.position.set(0.5, 0.35, 0.6);
  pole.rotation.z = 1.25;
  pole.castShadow = true;
  g.add(pole);

  // Поворот на +z уводит верхний конец шеста в -X, вымпел крепится туда же
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.4), burntMat);
  flag.material.side = THREE.DoubleSide;
  flag.position.set(-0.6, 0.6, 0.6);
  flag.rotation.set(0, 0.3, 0.2);
  g.add(flag);

  return { group: g, blink: null, radius: 1.2 };
}

/** Свежий удар: воронка и оплавленный обломок в ней. */
function buildMeteorite(rand) {
  const g = new THREE.Group();

  const scorch = new THREE.Mesh(new THREE.CircleGeometry(2.6, 24), dustMat);
  scorch.rotation.x = -Math.PI / 2;
  scorch.position.y = 0.03;
  g.add(scorch);

  const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 0), burntMat);
  rock.scale.set(1.2, 0.8, 1);
  rock.position.y = 0.32;
  rock.rotation.set(0.3, 0.8, 0.2);
  rock.castShadow = true;
  g.add(rock);

  // Разлетевшиеся осколки
  for (let i = 0; i < 7; i++) {
    const a = rand() * Math.PI * 2;
    const d = 0.9 + rand() * 1.5;
    const chip = new THREE.Mesh(new THREE.TetrahedronGeometry(0.1 + rand() * 0.12), burntMat);
    chip.position.set(Math.cos(a) * d, 0.08, Math.sin(a) * d);
    chip.rotation.set(rand() * 3, rand() * 3, rand() * 3);
    g.add(chip);
  }

  return { group: g, blink: null, radius: 1.0 };
}

const BUILDERS = {
  probe: buildProbeWreck,
  tracks: buildOldTracks,
  meteorite: buildMeteorite,
};

export function createFinds(scene, specs) {
  const rand = mulberry32(31337);

  return specs.map((spec, index) => {
    const built = BUILDERS[spec.type](rand);
    const y = terrainHeight(spec.x, spec.z);
    built.group.position.set(spec.x, y, spec.z);
    built.group.rotation.y = spec.rotation ?? rand() * 6;
    scene.add(built.group);

    // Об обломок можно споткнуться, но не залезть на него
    if (spec.type === "probe") {
      const p = addPlatform(spec.x, spec.z, 1.0, y + 1.1);
      p.kind = "find";
    }

    return {
      index,
      type: spec.type,
      x: spec.x,
      z: spec.z,
      group: built.group,
      blink: built.blink,
      near: spec.near,
      line: spec.line,
      found: false,
      hinted: false,
    };
  });
}

/** Мигание уцелевшего индикатора — единственная подвижная деталь находок. */
export function animateFinds(finds, time) {
  for (const find of finds) {
    if (!find.blink) continue;
    const pulse = (Math.sin(time * 2.2 + find.index) + 1) * 0.5;
    find.blink.material.emissiveIntensity = find.found ? 1.6 : 0.35 + pulse * 1.5;
  }
}

export function resetFinds(finds) {
  for (const find of finds) {
    find.found = false;
    find.hinted = false;
  }
}
