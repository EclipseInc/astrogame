import { launch, openGame, shot, sleep } from "../probe.mjs";

const { browser, page } = await launch({ width: 900, height: 760 });
await openGame(page);

const info = await page.evaluate(() => {
  const G = window.__game, P = G.game.player, C = G.collision;
  const cols = C.platforms.filter((p) => p.kind === "column");
  const a = cols[1];

  P.position.set(a.x, a.top, a.z);
  P.velocity.set(0, 0, 0);
  for (let i = 0; i < 5; i++) { G.game.update(1 / 60); G.input.endFrame(); }
  if (!P.torchOn) P.toggleTorch();
  P.facing = Math.atan2(cols[2].x - a.x, cols[2].z - a.z);
  P.model.body.rotation.y = P.facing;

  G.isoCam.snap({ x: (cols[0].x + cols[5].x) / 2, y: a.top - 2, z: (cols[0].z + cols[5].z) / 2 });
  const c = G.isoCam.camera;
  const asp = window.innerWidth / window.innerHeight;
  const v = 20;
  c.left = -v * asp; c.right = v * asp; c.top = v; c.bottom = -v;
  c.updateProjectionMatrix();

  // где лежит ячейка C относительно последней колонны
  const cell = G.game.scene.children
    .filter((o) => o.isGroup && o.children.some((ch) => ch.isPointLight))
    .map((o) => ({ x: +o.position.x.toFixed(1), y: +o.position.y.toFixed(2), z: +o.position.z.toFixed(1) }))
    .find((o) => Math.hypot(o.x - cols[5].x, o.z - cols[5].z) < 3);

  return { finishColumnTop: +cols[5].top.toFixed(2), cellOnFinish: cell };
});

await sleep(400);
const file = await shot(page, "darkzone");
console.log(JSON.stringify({ ...info, file, errors: page.__errors }, null, 2));
await browser.close();
