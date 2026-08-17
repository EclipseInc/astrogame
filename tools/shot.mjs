/**
 * Снимает один кадр игры для сравнения ДО/ПОСЛЕ.
 *   node tools/shot.mjs <имя> [x z] [--frames N] [--no-start]
 */
import { launch, openGame, teleport, step, shot, sleep } from "./probe.mjs";

const [name, ...rest] = process.argv.slice(2);
if (!name) {
  console.error("usage: node tools/shot.mjs <name> [x z] [--frames N]");
  process.exit(1);
}

const nums = rest.filter((a) => !a.startsWith("--")).map(Number);
const flag = (f) => rest.includes(f);
const opt = (f, d) => {
  const i = rest.indexOf(f);
  return i >= 0 ? Number(rest[i + 1]) : d;
};

const { browser, page } = await launch();
await openGame(page, { start: !flag("--no-start") });

if (nums.length >= 2) await teleport(page, nums[0], nums[1]);
const frames = opt("--frames", 0);
if (frames) await step(page, frames);

await sleep(350);
const file = await shot(page, name);

const errors = page.__errors;
await browser.close();

console.log(JSON.stringify({ file, errors }, null, 2));
if (errors.length) process.exitCode = 2;
