import { launch, openGame, shot, sleep } from "../probe.mjs";

const { browser, page } = await launch({ width: 620, height: 620 });
await openGame(page);

/**
 * Чистый эксперимент: гасим солнце и заливку, единственный источник — фонарь.
 * Игрок стоит перед одиночным валуном и светит прямо на него.
 * Если камень честно перекрывает луч, область ЗА камнем должна погаснуть.
 */
const setup = async (castShadow) => {
  await page.evaluate((cast) => {
    const G = window.__game, P = G.game.player, C = G.collision;
    document.getElementById("hud").style.display = "none";

    // одиночный валун: рядом на 14 м не должно быть других тел
    const rocks = C.platforms.filter((p) => p.kind === "rock" && p.r > 1.5);
    const rock = rocks.find((p) =>
      !C.platforms.some((o) => o !== p && Math.hypot(o.x - p.x, o.z - p.z) < 14)
    ) ?? rocks[0];
    window.__rock = { x: +rock.x.toFixed(1), z: +rock.z.toFixed(1), r: +rock.r.toFixed(2) };

    // гасим всё, кроме фонаря
    G.game.scene.traverse((o) => {
      if (o.isLight && o !== P.torch) o.intensity = 0;
    });

    P.position.set(rock.x - 6, -50, rock.z);
    P.velocity.set(0, 0, 0);
    for (let i = 0; i < 20; i++) { G.game.update(1 / 60); G.input.endFrame(); }
    P.facing = Math.PI / 2; // смотрим в +x, прямо на камень
    P.model.body.rotation.y = P.facing;
    if (!P.torchOn) P.toggleTorch();
    P.torch.castShadow = cast;

    G.isoCam.snap({ x: rock.x, y: 0, z: rock.z });
    const c = G.isoCam.camera;
    const a = window.innerWidth / window.innerHeight;
    const v = 12;
    c.left = -v * a; c.right = v * a; c.top = v; c.bottom = -v;
    c.updateProjectionMatrix();
  }, castShadow);
  await sleep(250);
};

const brightness = () =>
  page.evaluate(() => {
    const G = window.__game;
    G.renderer.clear();
    G.renderer.render(G.game.scene, G.isoCam.camera);
    const gl = document.getElementById("scene");
    const c = document.createElement("canvas");
    c.width = gl.width; c.height = gl.height;
    c.getContext("2d").drawImage(gl, 0, 0);
    const d = c.getContext("2d").getImageData(0, 0, gl.width, gl.height).data;
    let sum = 0;
    for (let i = 0; i < d.length; i += 4) sum += (d[i] + d[i + 1] + d[i + 2]) / 3;
    return +(sum / (d.length / 4)).toFixed(3);
  });

await setup(false);
const beforeShot = await shot(page, "torch-before");
const beforeLum = await brightness();

await setup(true);
const afterShot = await shot(page, "torch-after");
const afterLum = await brightness();

console.log(JSON.stringify({
  rock: await page.evaluate(() => window.__rock),
  litByTorch: { throughRock: beforeLum, blockedByRock: afterLum,
                drop: +(100 * (1 - afterLum / beforeLum)).toFixed(1) + "%" },
  beforeShot, afterShot, errors: page.__errors,
}, null, 2));
await browser.close();
