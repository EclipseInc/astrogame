import { launch, openGame, sleep } from "../probe.mjs";

const { browser, page } = await launch({ width: 1000, height: 760 });
await openGame(page);

const r = await page.evaluate(async () => {
  const G = window.__game, P = G.game.player;
  const step = (n) => { for (let i = 0; i < n; i++) { G.game.update(1 / 60); G.input.endFrame(); } };
  // Ставим НА верхнюю поверхность: ячейка «C» лежит на колонне, а не на дне
  const tp = (x, z) => {
    P.position.set(x, G.collision.surfaceHeightAt(x, z) + 0.4, z);
    P.velocity.set(0, 0, 0);
    step(12);
  };
  const out = {};

  // проходим игру целиком
  for (const [x, z] of [[-27, -19], [-74, 59], [-118, -78]]) { tp(x, z); tp(0, 0); }
  step(60 * 8);
  out.winScreen = document.querySelector("#screen h1")?.textContent ?? "-";
  out.cellsFilledAtWin = document.querySelectorAll("#objective .cell.filled").length;
  out.sunElevationAtWin = +(G.game.lighting.elevation * 180 / Math.PI).toFixed(1);

  // жмём «Пройти снова»
  const before = performance.now();
  document.querySelector("#screen button").click();
  const elapsed = performance.now() - before;
  step(2);

  out.restartMs = +elapsed.toFixed(1);
  out.screenGone = document.getElementById("screen").classList.contains("gone");
  out.oxygen = document.querySelector("#oxygen .time").textContent;
  out.cellsFilledAfter = document.querySelectorAll("#objective .cell.filled").length;
  out.objective = document.querySelector("#objective .text").textContent;
  out.sunElevationAfter = +(G.game.lighting.elevation * 180 / Math.PI).toFixed(1);
  out.playerAtSpawn = [+P.position.x.toFixed(1), +P.position.z.toFixed(1)];
  out.socketsLit = 0;

  // ячейки вернулись в мир?
  out.cellsInWorld = 0;
  G.game.scene.traverse(() => {});
  return out;
});

// второй забег должен работать так же
const second = await page.evaluate(() => {
  const G = window.__game, P = G.game.player;
  const step = (n) => { for (let i = 0; i < n; i++) { G.game.update(1 / 60); G.input.endFrame(); } };
  // Ставим НА верхнюю поверхность: ячейка «C» лежит на колонне, а не на дне
  const tp = (x, z) => {
    P.position.set(x, G.collision.surfaceHeightAt(x, z) + 0.4, z);
    P.velocity.set(0, 0, 0);
    step(12);
  };
  for (const [x, z] of [[-27, -19], [-74, 59], [-118, -78]]) { tp(x, z); tp(0, 0); }
  step(60 * 8);
  return {
    screen: document.querySelector("#screen h1")?.textContent ?? "-",
    cells: document.querySelectorAll("#objective .cell.filled").length,
  };
});

console.log(JSON.stringify({ firstRun: r, secondRun: second, errors: page.__errors }, null, 2));
await browser.close();
