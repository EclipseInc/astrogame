import { launch, openGame } from "../probe.mjs";

const { browser, page } = await launch({ width: 1000, height: 760 });
await openGame(page);

const r = await page.evaluate(() => {
  const G = window.__game, P = G.game.player;
  const step = (n) => { for (let i = 0; i < n; i++) { G.game.update(1 / 60); G.input.endFrame(); } };
  const put = (x, z) => {
    P.position.set(x, G.collision.surfaceHeightAt(x, z) + 0.4, z);
    P.velocity.set(0, 0, 0);
    step(10);
  };
  const count = () => +document.getElementById("find-count").textContent;
  const sub = () => document.getElementById("subtitle").textContent.slice(0, 46);

  const spots = [[62, -38], [-46, 104], [-152, 26]];
  const log = [];

  // издалека — наводка, вблизи — сама находка
  put(spots[0][0] + 30, spots[0][1] + 20);
  log.push({ stage: "наводка с 36 м", finds: count(), said: sub() });

  for (const [x, z] of spots) {
    put(x + 1.5, z + 1.5);
    log.push({ stage: `находка (${x},${z})`, finds: count(), said: sub() });
  }

  // повторный подход не должен считаться второй раз
  put(spots[0][0] + 1.5, spots[0][1] + 1.5);
  const afterRevisit = count();

  // рестарт должен сбросить находки
  document.querySelector("#screen button")?.click();
  const G2 = window.__game;
  G2.game.update(1 / 60);

  return { log, afterRevisit, findsAfterRevisit: count() };
});

// рестарт через экран проигрыша
const afterRestart = await page.evaluate(() => {
  const G = window.__game;
  const step = (n) => { for (let i = 0; i < n; i++) { G.game.update(1 / 60); G.input.endFrame(); } };
  step(60 * 250); // выжигаем кислород -> экран проигрыша
  document.querySelector("#screen button").click();
  step(2);
  return { finds: +document.getElementById("find-count").textContent,
           screenGone: document.getElementById("screen").classList.contains("gone") };
});

console.log(JSON.stringify({ ...r, afterRestart, errors: page.__errors }, null, 2));
await browser.close();
