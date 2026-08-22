import puppeteer from "puppeteer";

const browser = await puppeteer.launch({
  headless: true,
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
         "--no-sandbox", "--autoplay-policy=no-user-gesture-required"],
  defaultViewport: { width: 900, height: 600 },
});
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

await page.goto("http://localhost:5373/astrogame/", { waitUntil: "networkidle0" });
await page.click("#start");
await new Promise((r) => setTimeout(r, 2500));

// прод-сборка: дев-хука нет, проверяем что игра реально идёт
const out = await page.evaluate(() => ({
  devHook: !!window.__game,
  oxygen: document.querySelector("#oxygen .time")?.textContent,
  hudVisible: !document.getElementById("hud").classList.contains("hidden"),
  screenGone: document.getElementById("screen").classList.contains("gone"),
  canvasPainted: (() => {
    const c = document.getElementById("scene");
    return c.width > 0 && c.height > 0;
  })(),
}));

await new Promise((r) => setTimeout(r, 1500));
const oxygenLater = await page.evaluate(() => document.querySelector("#oxygen .time")?.textContent);

console.log(JSON.stringify({ ...out, oxygenLater, errors }, null, 2));
await browser.close();
