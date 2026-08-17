/**
 * Пара кадров «камень как препятствие»: старое поведение (валун — глухая стена,
 * стоять сверху нельзя) и новое (на валун можно запрыгнуть).
 * Старое воспроизводим в рантайме, файлы проекта не трогаем.
 */
import { launch, openGame, shot, sleep } from "./probe.mjs";

const { browser, page } = await launch({ width: 620, height: 620 });
await openGame(page);

// Подбираем валун подходящей высоты рядом с точкой старта
const rock = await page.evaluate(() => {
  const C = window.__game.collision;
  const terrain = (x, z) => C.groundHeightAt(x, z, -1e9);
  const cands = C.platforms
    .filter((p) => p.kind === "rock" && p.r > 1.2)
    .map((p) => ({ p, rise: p.top - terrain(p.x, p.z), d: Math.hypot(p.x - 15, p.z + 10) }))
    .filter((c) => c.rise > 1.4 && c.rise < 3.4)
    .sort((a, b) => a.d - b.d);
  const best = cands[0].p;
  return { x: best.x, z: best.z, r: best.r, top: best.top };
});

const frame = async (legacy, name) => {
  await page.evaluate(
    (rock, legacy) => {
      const G = window.__game;
      const C = G.collision;
      const P = G.game.player;

      document.getElementById("hud").style.display = "none";

      // как было: валуны — глухие цилиндры без верха
      if (legacy && !window.__legacyOn) {
        window.__legacyOn = true;
        window.__tops = new Map();
        for (const p of C.platforms) {
          if (p.kind !== "rock") continue;
          window.__tops.set(p, p.top);
          p.top = -9999;
          C.addBlocker(p.x, p.z, p.r);
        }
      }

      P.position.set(rock.x, rock.top + 4, rock.z);
      P.velocity.set(0, 0, 0);
      for (let i = 0; i < 140; i++) {
        G.game.update(1 / 60);
        G.input.endFrame();
      }

      // камера всегда одна и та же — смотрим на сам валун
      G.isoCam.snap({ x: rock.x, y: rock.top - 1, z: rock.z });
      const c = G.isoCam.camera;
      const a = window.innerWidth / window.innerHeight;
      const v = 4.2;
      c.left = -v * a;
      c.right = v * a;
      c.top = v;
      c.bottom = -v;
      c.updateProjectionMatrix();
    },
    rock,
    legacy
  );
  await sleep(220);
  return shot(page, name);
};

const after = await frame(false, "rock-after");
const before = await frame(true, "rock-before");

const state = await page.evaluate(() => {
  const P = window.__game.game.player;
  return { y: +P.position.y.toFixed(2), grounded: P.grounded };
});

const errors = page.__errors;
await browser.close();
console.log(JSON.stringify({ rock, before, after, legacyEnd: state, errors }, null, 2));
