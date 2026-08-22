import { launch, openGame } from "../probe.mjs";

const { browser, page } = await launch({ width: 900, height: 700 });
await openGame(page);

/**
 * Проходимость курса. Прыжок дозируется удержанием Space: 5.8 м коротким
 * нажатием, 9.2 м с зажатым. Поэтому мало знать «долетает ли» — важно, есть ли
 * окно удержания, попадающее на колонну, и насколько оно широкое.
 * Окно в кадрах при 60 fps: 6 кадров = 0.1 с, играбельный минимум.
 */
const r = await page.evaluate(() => {
  const G = window.__game, P = G.game.player, C = G.collision;
  const cols = C.platforms.filter((p) => p.kind === "column");

  const tryJump = (a, b, hold) => {
    const dx = b.x - a.x, dz = b.z - a.z;
    const yaw = Math.atan2(-dx, -dz);
    P.position.set(a.x, a.top, a.z);
    P.velocity.set(0, 0, 0);
    P.grounded = true; P.coyote = 0.12; P.buffer = 0;

    let frame = 0;
    const input = {
      moveX: 0, moveZ: 1,
      get jumpHeld() { return frame < hold; },
      justPressed: (k) => k === "jump" && frame === 0,
    };
    for (frame = 0; frame < 260; frame++) {
      P.update(1 / 60, input, yaw);
      if (frame > 5 && P.grounded) {
        const d = Math.hypot(P.position.x - b.x, P.position.z - b.z);
        return d <= b.r && Math.abs(P.position.y - b.top) < 0.4;
      }
    }
    return false;
  };

  const results = [];
  for (let i = 0; i < cols.length - 1; i++) {
    const a = cols[i], b = cols[i + 1];
    const hits = [];
    for (let hold = 4; hold <= 90; hold++) if (tryJump(a, b, hold)) hits.push(hold);

    results.push({
      jump: `${i} -> ${i + 1}`,
      gap: +Math.hypot(b.x - a.x, b.z - a.z).toFixed(2),
      drop: +(b.top - a.top).toFixed(2),
      targetR: +b.r.toFixed(2),
      windowFrames: hits.length,
      holdRange: hits.length ? [hits[0], hits.at(-1)] : null,
      passable: hits.length > 0,
    });
  }
  return { columns: cols.length, results };
});

const passable = r.results.filter((x) => x.passable).length;
const tight = r.results.filter((x) => x.passable && x.windowFrames < 6);
console.log(JSON.stringify({
  ...r,
  passable: `${passable}/${r.results.length}`,
  tooTight: tight.map((x) => x.jump),
}, null, 2));
console.log("errors:", JSON.stringify(page.__errors));
await browser.close();
