import { launch, openGame, shot, sleep } from "../probe.mjs";

const { browser, page } = await launch({ width: 460, height: 460 });
await openGame(page);

const spots = [[62, -38, "probe"], [-46, 104, "tracks"], [-152, 26, "meteorite"]];
const files = [];

for (const [x, z, name] of spots) {
  await page.evaluate((x, z) => {
    const G = window.__game, P = G.game.player;
    document.getElementById("hud").style.display = "none";
    P.position.set(x + 3, G.collision.surfaceHeightAt(x + 3, z + 3) + 0.4, z + 3);
    P.velocity.set(0, 0, 0);
    for (let i = 0; i < 10; i++) { G.game.update(1 / 60); G.input.endFrame(); }
    G.isoCam.snap({ x, y: 0, z });
    const c = G.isoCam.camera;
    const a = window.innerWidth / window.innerHeight;
    const v = 4.5;
    c.left = -v * a; c.right = v * a; c.top = v; c.bottom = -v;
    c.updateProjectionMatrix();
  }, x, z);
  await sleep(300);
  files.push(await shot(page, `find-${name}`));
}

console.log(JSON.stringify({ files, errors: page.__errors }, null, 2));
await browser.close();
