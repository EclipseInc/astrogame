/**
 * Изолированный стенд для проверки правок.
 *
 * Работает по своему dev-серверу (порт 5273), поднимает headless Chrome,
 * управляет игрой через дев-хук window.__game и снимает кадры.
 * Никаких данных в проекте не оставляет: сырые кадры удаляются, остаётся
 * только собранный композит в tools/out/.
 */
import puppeteer from "puppeteer";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";

export const PORT = 5273;
export const BASE = `http://localhost:${PORT}`;
export const SHOTS = path.resolve("tools/shots");
export const OUT = path.resolve("tools/out");

export async function launch({ width = 1280, height = 720 } = {}) {
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      "--use-gl=angle",
      "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader",
      "--disable-dev-shm-usage",
      "--no-sandbox",
    ],
    defaultViewport: { width, height, deviceScaleFactor: 1 },
  });
  const page = await browser.newPage();

  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.__errors = errors;

  return { browser, page };
}

/** Загружает игру и ждёт, пока появится дев-хук. */
export async function openGame(page, { start = true } = {}) {
  await page.goto(BASE, { waitUntil: "networkidle0" });
  await page.waitForFunction(() => !!window.__game, { timeout: 20000 });
  if (start) {
    await page.click("#start");
    await sleep(900); // экран стартового меню уезжает за 0.8 с
  }
}

/** Ставит игрока в точку и даёт ему опуститься на грунт. */
export async function teleport(page, x, z, settleFrames = 20) {
  await page.evaluate(
    (x, z, n) => {
      const G = window.__game;
      G.game.player.position.set(x, -50, z);
      G.game.player.velocity.set(0, 0, 0);
      for (let i = 0; i < n; i++) {
        G.game.update(1 / 60);
        G.input.endFrame();
      }
      G.isoCam.snap(G.game.player.position);
    },
    x,
    z,
    settleFrames
  );
  await sleep(120);
}

/** Прогоняет N кадров симуляции детерминированно, без ожидания rAF. */
export async function step(page, frames) {
  await page.evaluate((n) => {
    const G = window.__game;
    for (let i = 0; i < n; i++) {
      G.game.update(1 / 60);
      G.input.endFrame();
    }
  }, frames);
}

export async function key(page, code, downMs = 0) {
  await page.evaluate((c) => {
    window.dispatchEvent(new KeyboardEvent("keydown", { code: c, bubbles: true }));
  }, code);
  if (downMs) {
    await sleep(downMs);
    await page.evaluate((c) => {
      window.dispatchEvent(new KeyboardEvent("keyup", { code: c, bubbles: true }));
    }, code);
  }
}

export async function shot(page, name) {
  await mkdir(SHOTS, { recursive: true });
  const file = path.join(SHOTS, `${name}.png`);
  await page.screenshot({ path: file });
  return file;
}

/** Сырые кадры — мусор стенда, после сборки композита их не остаётся. */
export async function cleanup() {
  await rm(SHOTS, { recursive: true, force: true });
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
