/**
 * Раскадровка ходьбы крупным планом: N кадров подряд с фиксированным шагом
 * симуляции. Нужна, чтобы увидеть рывки анимации, которых не видно на одном кадре.
 *   node tools/walkstrip.mjs <префикс> [--zoom 3.2] [--every 5] [--count 8]
 */
import { launch, openGame, teleport, shot, sleep } from "./probe.mjs";

const [prefix = "walk", ...rest] = process.argv.slice(2);
const opt = (f, d) => {
  const i = rest.indexOf(f);
  return i >= 0 ? Number(rest[i + 1]) : d;
};
const zoom = opt("--zoom", 3.2);
const every = opt("--every", 5);
const count = opt("--count", 8);

const { browser, page } = await launch({ width: 640, height: 640 });
await openGame(page);
await teleport(page, 15, 24);

// Крупный план: ортокамера сжимается вокруг игрока
await page.evaluate((z) => {
  const c = window.__game.isoCam.camera;
  const a = window.innerWidth / window.innerHeight;
  const v = 12.5 / z;
  c.left = -v * a;
  c.right = v * a;
  c.top = v;
  c.bottom = -v;
  c.updateProjectionMatrix();
  window.__lockZoom = () => {
    c.left = -v * a;
    c.right = v * a;
    c.top = v;
    c.bottom = -v;
    c.updateProjectionMatrix();
  };
}, zoom);

// Идём вперёд и снимаем кадры по ходу
await page.evaluate(() =>
  window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyW", bubbles: true }))
);

const files = [];
for (let i = 0; i < count; i++) {
  await page.evaluate((n) => {
    const G = window.__game;
    for (let k = 0; k < n; k++) {
      G.game.update(1 / 60);
      G.input.endFrame();
    }
    window.__lockZoom();
  }, every);
  await sleep(90);
  files.push(await shot(page, `${prefix}-${String(i).padStart(2, "0")}`));
}

await page.evaluate(() =>
  window.dispatchEvent(new KeyboardEvent("keyup", { code: "KeyW", bubbles: true }))
);

const errors = page.__errors;
await browser.close();
console.log(JSON.stringify({ files, errors }, null, 2));
