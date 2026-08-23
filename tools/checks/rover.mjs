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
    P.velocity.set(0, 0, 0);
    step(8);
  };
  const out = {};

  // найдём объекты сцены
  const roverGroup = G.game.scene.children.find((o) => o.name === "rover");
  out.roverStart = [+roverGroup.position.x.toFixed(1), +roverGroup.position.z.toFixed(1)];

  // 1) до починки посадка не работает
  put(18, 15);
  tap("KeyR");
  out.canDriveBeforeRepair = P.model.root.visible === false;

  // 2) подбираем колесо -> починка
  put(18 + 5.4, 15 + 3.2);
  out.fixedAfterWheel = document.getElementById("subtitle").textContent.includes("ровер на ходу");

  // 3) садимся
  put(18, 15);
  tap("KeyR");
  out.driving = P.model.root.visible === false;
  out.markerHidden = P.marker.visible === false;

  // 4) едем вперёд 3 секунды и меряем путь
  const from = roverGroup.position.clone();
  key("keydown", "KeyW");
  step(180);
  key("keyup", "KeyW");
  const dist = +from.distanceTo(roverGroup.position).toFixed(1);
  out.drove = { meters: dist, mps: +(dist / 3).toFixed(1) };
  out.playerFollows = +P.position.distanceTo(roverGroup.position).toFixed(2);
  out.onGround = Math.abs(roverGroup.position.y - G.collision.groundHeightAt(roverGroup.position.x, roverGroup.position.z)) < 0.05;

  // 5) выходим
  tap("KeyR");
  out.exited = P.model.root.visible === true && P.marker.visible === true;
  out.exitGap = +P.position.distanceTo(roverGroup.position).toFixed(2);

  return out;
});

// пеший темп для сравнения
const walk = await page.evaluate(() => {
  const G = window.__game, P = G.game.player;
  const step = (n) => { for (let i = 0; i < n; i++) { G.game.update(1 / 60); G.input.endFrame(); } };
  P.position.set(40, G.collision.surfaceHeightAt(40, 40) + 0.3, 40); P.velocity.set(0, 0, 0); step(10);
  const from = P.position.clone();
  window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyW", bubbles: true }));
  step(180);
  window.dispatchEvent(new KeyboardEvent("keyup", { code: "KeyW", bubbles: true }));
  const d = from.distanceTo(P.position);
  return { meters: +d.toFixed(1), mps: +(d / 3).toFixed(1) };
});

console.log(JSON.stringify({ ...r, walking: walk, errors: page.__errors }, null, 2));
await browser.close();
