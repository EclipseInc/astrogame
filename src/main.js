import * as THREE from "three";
import { createInput } from "./core/input.js";
import { createIsoCamera } from "./camera/isoCamera.js";
import { createSky } from "./world/sky.js";
import { createHUD } from "./ui/hud.js";
import { createMinimap } from "./ui/minimap.js";
import { createAudio } from "./audio/audio.js";
import { createGame } from "./game/game.js";

const canvas = document.getElementById("scene");

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: "high-performance",
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.autoClear = false;

const input = createInput();
const hud = createHUD();
const isoCam = createIsoCamera(window.innerWidth / window.innerHeight);
const sky = createSky();
sky.resize(window.innerWidth / window.innerHeight);

const minimap = createMinimap();
const audio = createAudio();
hud.bindMute(audio);
const game = createGame({ hud, input, isoCam, minimap, audio });

window.addEventListener("resize", () => {
  const aspect = window.innerWidth / window.innerHeight;
  renderer.setSize(window.innerWidth, window.innerHeight);
  isoCam.resize(aspect);
  sky.resize(aspect);
});

let started = false;
document.getElementById("start").addEventListener("click", () => {
  if (started) return;
  started = true;
  // Браузер разрешает звук только из обработчика жеста — вот он
  audio.init();
  audio.radio();
  hud.hideScreen();
  hud.show();
});

// Дев-хук: удобно дёргать шаги симуляции и состояние из консоли
if (import.meta.env.DEV) {
  const collision = await import("./world/collision.js");
  window.__game = { game, isoCam, input, renderer, collision, minimap, audio };
}

const clock = new THREE.Clock();

function frame() {
  requestAnimationFrame(frame);

  // Клампим шаг: после сворачивания вкладки dt может быть огромным
  const dt = Math.min(clock.getDelta(), 1 / 20);
  if (started) game.update(dt);
  input.endFrame();

  sky.sync(isoCam.camera);

  renderer.clear();
  renderer.render(sky.scene, sky.camera);
  renderer.clearDepth();
  renderer.render(game.scene, isoCam.camera);
}

frame();
