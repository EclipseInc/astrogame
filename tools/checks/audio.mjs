import { launch, openGame, teleport, sleep } from "../probe.mjs";

const { browser, page } = await launch({ width: 1000, height: 760 });
await openGame(page);

const r = await page.evaluate(async () => {
  const G = window.__game, A = G.audio, P = G.game.player;
  const out = { ctxState: "n/a", counts: {} };

  // считаем реальные вызовы звуковых событий из игровой логики
  const spy = {};
  for (const k of ["step", "jump", "land", "pickup", "deposit", "canister", "radio", "warning", "win", "fail"]) {
    const orig = A[k].bind(A);
    spy[k] = 0;
    A[k] = (...a) => { spy[k]++; return orig(...a); };
  }

  const step = (n) => { for (let i = 0; i < n; i++) { G.game.update(1 / 60); G.input.endFrame(); } };
  const key = (t, code) => window.dispatchEvent(new KeyboardEvent(t, { code, bubbles: true }));

  // бегаем и прыгаем
  key("keydown", "KeyW");
  for (let i = 0; i < 300; i++) { if (i % 50 === 0) key("keydown", "Space"); step(1); if (i % 50 === 3) key("keyup", "Space"); }
  key("keyup", "KeyW");

  // подбор ячейки, баллона, доставка
  const tp = (x, z) => { P.position.set(x, -50, z); P.velocity.set(0, 0, 0); step(12); };
  tp(-27, -19); tp(0, 0);
  tp(-12, -30);

  out.ctxState = A.ready ? "ready" : "not-ready";
  out.counts = spy;
  out.mutedBefore = A.muted;
  A.toggleMute();
  out.mutedAfter = A.muted;
  A.toggleMute();
  out.persisted = localStorage.getItem("lastsignal.muted");
  return out;
});

// состояние AudioContext достаём отдельно: оно живёт внутри замыкания
const ctxAlive = await page.evaluate(() => {
  // косвенно: если звук работает, узлы создаются без исключений
  try { window.__game.audio.step(); return "no-throw"; } catch (e) { return "throw: " + e.message; }
});

console.log(JSON.stringify({ ...r, ctxAlive, errors: page.__errors }, null, 2));
await browser.close();
