import { launch, openGame, shot, sleep } from "../probe.mjs";

const { browser, page } = await launch({ width: 620, height: 620 });
await openGame(page);

await page.evaluate(() => {
  const G = window.__game, P = G.game.player;
  const step = (n) => { for (let i = 0; i < n; i++) { G.game.update(1 / 60); G.input.endFrame(); } };
  const key = (t, c) => window.dispatchEvent(new KeyboardEvent(t, { code: c, bubbles: true }));
  const put = (x, z) => {
    P.position.set(x, G.collision.surfaceHeightAt(x, z) + 0.4, z);
    P.velocity.set(0, 0, 0); step(8);
  };
  document.getElementById("hud").style.display = "none";

  put(18 + 5.4, 15 + 3.2);          // колесо -> починка
  put(18, 15);
  key("keydown", "KeyR"); step(2); key("keyup", "KeyR"); step(1);
  key("keydown", "KeyW"); step(120); key("keyup", "KeyW"); // разогнались

  const rover = G.game.scene.children.find((o) => o.name === "rover");
  G.isoCam.snap(rover.position);
  const c = G.isoCam.camera;
  const a = window.innerWidth / window.innerHeight;
  const v = 7;
  c.left = -v * a; c.right = v * a; c.top = v; c.bottom = -v;
  c.updateProjectionMatrix();
});

await sleep(400);
const file = await shot(page, "rover-driving");
console.log(JSON.stringify({ file, errors: page.__errors }, null, 2));
await browser.close();
