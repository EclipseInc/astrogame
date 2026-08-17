/**
 * Космонавт крупным планом с четырёх сторон: проверка посадки шлема и визора.
 *   node tools/faces.mjs <префикс>
 */
import { launch, openGame, teleport, shot, sleep } from "./probe.mjs";

const prefix = process.argv[2] ?? "face";

const { browser, page } = await launch({ width: 420, height: 420 });
await openGame(page);
await teleport(page, 15, 24);

const files = [];
for (let i = 0; i < 4; i++) {
  await page.evaluate((facing) => {
    const G = window.__game;
    const P = G.game.player;
    P.facing = facing;
    P.model.body.rotation.y = facing;
    G.isoCam.snap(P.position);

    const c = G.isoCam.camera;
    const a = window.innerWidth / window.innerHeight;
    const v = 1.5;
    c.left = -v * a;
    c.right = v * a;
    c.top = v;
    c.bottom = -v;
    c.updateProjectionMatrix();
  }, (i * Math.PI) / 2 + Math.PI / 4);

  await sleep(160);
  files.push(await shot(page, `${prefix}-${i}`));
}

const errors = page.__errors;
await browser.close();
console.log(JSON.stringify({ files, errors }, null, 2));
