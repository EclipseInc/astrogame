/**
 * Пара кадров головы: со старой геометрией визора и с новой.
 * Старую собираем прямо в рантайме, файлы проекта не трогаем.
 */
import { launch, openGame, teleport, shot, sleep } from "./probe.mjs";

const { browser, page } = await launch({ width: 460, height: 460 });
await openGame(page);
await teleport(page, 15, 24);

const setup = async (old) => {
  await page.evaluate((useOld) => {
    const G = window.__game;
    const P = G.game.player;

    let visor = null;
    P.model.body.traverse((o) => {
      if (o.isMesh && o.material.metalness > 0.9) visor = o;
    });
    const Sphere = visor.geometry.constructor;

    if (useOld) {
      window.__newVisor = visor.geometry;
      // как было: phi отсчитан от 0, из-за чего окно уезжало на висок
      visor.geometry = new Sphere(0.335, 20, 16, -0.9, 1.8, 0.7, 1.0);
    } else if (window.__newVisor) {
      visor.geometry = window.__newVisor;
    }

    // HUD мешает крупному плану — прячем только в кадре стенда
    document.getElementById("hud").style.display = "none";

    // лицом к камере
    P.facing = Math.PI / 4;
    P.model.body.rotation.y = P.facing;
    G.isoCam.snap(P.position);

    const c = G.isoCam.camera;
    const a = window.innerWidth / window.innerHeight;
    const v = 0.85;
    c.left = -v * a;
    c.right = v * a;
    c.top = v + 0.35;
    c.bottom = -v + 0.35;
    c.updateProjectionMatrix();
  }, old);
  await sleep(200);
};

await setup(true);
const before = await shot(page, "head-before");
await setup(false);
const after = await shot(page, "head-after");

const errors = page.__errors;
await browser.close();
console.log(JSON.stringify({ before, after, errors }, null, 2));
