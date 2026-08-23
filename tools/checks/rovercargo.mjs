import { launch, openGame } from "../probe.mjs";

const { browser, page } = await launch({ width: 1000, height: 760 });
await openGame(page);

const r = await page.evaluate(() => {
  const G = window.__game, P = G.game.player;
  const step = (n) => { for (let i = 0; i < n; i++) { G.game.update(1 / 60); G.input.endFrame(); } };
  const key = (t, c) => window.dispatchEvent(new KeyboardEvent(t, { code: c, bubbles: true }));
  const tap = (c) => { key("keydown", c); step(2); key("keyup", c); step(1); };
  const put = (x, z) => {
    P.position.set(x, G.collision.surfaceHeightAt(x, z) + 0.4, z);
    P.velocity.set(0, 0, 0); step(8);
  };
  const rover = G.game.scene.children.find((o) => o.name === "rover");

  // чиним и берём ячейку
  put(18 + 5.4, 15 + 3.2);
  put(-27, -19);
  const cellGroup = P.model.carrySlot.children[0];
  const out = { pickedOnFoot: !!cellGroup };

  // садимся с ячейкой в руках
  put(18, 15);
  tap("KeyR");
  out.cargoOnRover = rover.getObjectById(cellGroup.id) === cellGroup;
  out.cellVisibleWhileDriving = (() => {
    let o = cellGroup, vis = true;
    while (o) { vis = vis && o.visible; o = o.parent; }
    return vis;
  })();

  // едем к антенне и сдаём не выходя
  // Проверяем механику сдачи, а не умение водить: ставим ровер на площадку
  rover.position.set(3.2, G.collision.groundHeightAt(3.2, 3.2), 3.2);
  step(4);
  out.stoppedAt = +Math.hypot(rover.position.x, rover.position.z).toFixed(2);
  out.deliveredFromRover = document.querySelectorAll("#objective .cell.filled").length;

  // выходим — ячейку уже сдали, проверяем что ничего не сломалось
  tap("KeyR");
  out.exitedFine = P.model.root.visible === true;
  return out;
});

console.log(JSON.stringify({ ...r, errors: page.__errors }, null, 2));
await browser.close();
