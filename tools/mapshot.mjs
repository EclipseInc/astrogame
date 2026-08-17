/**
 * Карта: открыть по M, поставить метки кликом, снять кадр.
 * Проверяет и постановку, и снятие метки повторным кликом.
 */
import { launch, openGame, teleport, shot, sleep } from "./probe.mjs";

const { browser, page } = await launch({ width: 1000, height: 760 });
await openGame(page);
await teleport(page, -40, 30);

await page.evaluate(() => {
  window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyM", bubbles: true }));
  window.dispatchEvent(new KeyboardEvent("keyup", { code: "KeyM", bubbles: true }));
});
await sleep(400);

const box = await (await page.$("#map-canvas")).boundingBox();
const at = (fx, fy) => ({ x: box.x + box.width * fx, y: box.y + box.height * fy });

// три метки в разных углах
const spots = [
  [0.3, 0.68],
  [0.62, 0.35],
  [0.45, 0.5],
];
for (const [fx, fy] of spots) {
  const p = at(fx, fy);
  await page.mouse.click(p.x, p.y);
  await sleep(120);
}
const afterAdd = await page.evaluate(() => window.__game.minimap.markers.length);

// повторный клик по последней метке — снимаем её
const last = at(...spots[2]);
await page.mouse.click(last.x, last.y);
await sleep(150);
const afterRemove = await page.evaluate(() => window.__game.minimap.markers.length);

// ставим обратно, чтобы на кадре было три метки
await page.mouse.click(last.x, last.y);
await sleep(300);

const file = await shot(page, "map-open");
const errors = page.__errors;
await browser.close();
console.log(JSON.stringify({ file, afterAdd, afterRemove, errors }, null, 2));
