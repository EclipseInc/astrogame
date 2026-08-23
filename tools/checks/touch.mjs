import puppeteer from "puppeteer";
import { PORT } from "../probe.mjs";

const browser = await puppeteer.launch({
  headless: true,
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
         "--no-sandbox", "--autoplay-policy=no-user-gesture-required"],
});
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

// телефон в альбомной ориентации
await page.setViewport({ width: 844, height: 390, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
await page.goto(`http://localhost:${PORT}/astrogame/?touch`, { waitUntil: "networkidle0" });
await page.waitForFunction(() => !!window.__game);
await page.click("#start");
await new Promise((r) => setTimeout(r, 800));

const out = {};
out.touchMode = await page.evaluate(() => document.body.classList.contains("touch-mode"));

// размеры зон нажатия
out.targets = await page.evaluate(() =>
  [...document.querySelectorAll("#touch .tbtn, #stick")].map((el) => {
    const r = el.getBoundingClientRect();
    return { el: el.id || el.dataset.action, w: Math.round(r.width), h: Math.round(r.height) };
  })
);
out.tooSmall = out.targets.filter((t) => t.w < 44 || t.h < 44);

// стик: тянем вверх — космонавт должен пойти
const stick = await page.$("#stick");
const box = await stick.boundingBox();
const cx = box.x + box.width / 2, cy = box.y + box.height / 2;

const before = await page.evaluate(() => {
  const p = window.__game.game.player.position;
  return { x: p.x, z: p.z };
});

await page.touchscreen.touchStart(cx, cy);
await page.touchscreen.touchMove(cx, cy - 44);
out.axisWhileHeld = await page.evaluate(() => ({
  x: +window.__game.input.moveX.toFixed(2),
  z: +window.__game.input.moveZ.toFixed(2),
}));
await new Promise((r) => setTimeout(r, 1200));
await page.touchscreen.touchEnd();

const after = await page.evaluate(() => {
  const p = window.__game.game.player.position;
  return { x: p.x, z: p.z };
});
out.movedByStick = +Math.hypot(after.x - before.x, after.z - before.z).toFixed(2);
out.axisAfterRelease = await page.evaluate(() => ({
  x: window.__game.input.moveX, z: window.__game.input.moveZ,
}));

// кнопка прыжка
const jump = await (await page.$('[data-action="jump"]')).boundingBox();
await page.touchscreen.touchStart(jump.x + jump.width / 2, jump.y + jump.height / 2);
await new Promise((r) => setTimeout(r, 120));
out.airborneAfterJump = await page.evaluate(() => !window.__game.game.player.grounded);
await page.touchscreen.touchEnd();

// кнопка карты
const mapBtn = await (await page.$('[data-action="map"]')).boundingBox();
await page.touchscreen.tap(mapBtn.x + mapBtn.width / 2, mapBtn.y + mapBtn.height / 2);
await new Promise((r) => setTimeout(r, 300));
out.mapOpened = await page.evaluate(() => window.__game.minimap.open);
out.touchHiddenUnderMap = await page.evaluate(() =>
  getComputedStyle(document.getElementById("touch")).display === "none");

// карта на телефоне должна закрываться кнопкой, а не только клавишей
const closeBtn = await (await page.$("#map-close")).boundingBox();
await page.touchscreen.tap(closeBtn.x + closeBtn.width / 2, closeBtn.y + closeBtn.height / 2);
await new Promise((r) => setTimeout(r, 300));
out.mapClosedByButton = await page.evaluate(() => !window.__game.minimap.open);
out.closeBtnSize = { w: Math.round(closeBtn.width), h: Math.round(closeBtn.height) };

await page.screenshot({ path: "tools/shots/touch-landscape.png" });

// портрет: должна появиться просьба повернуть устройство
await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
await new Promise((r) => setTimeout(r, 300));
out.rotateHintInPortrait = await page.evaluate(() =>
  getComputedStyle(document.getElementById("rotate-hint")).display !== "none");

console.log(JSON.stringify({ ...out, errors }, null, 2));
await browser.close();
