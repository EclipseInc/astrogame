import puppeteer from "puppeteer";
const browser = await puppeteer.launch({ headless: true,
  args: ["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader","--no-sandbox","--autoplay-policy=no-user-gesture-required"] });
const page = await browser.newPage();
await page.setViewport({ width: 844, height: 390, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
await page.goto("http://localhost:5273/astrogame/?touch", { waitUntil: "networkidle0" });
await page.waitForFunction(() => !!window.__game);
await page.click("#start");
await new Promise(r => setTimeout(r, 1200));
await page.screenshot({ path: "tools/shots/touch-game.png" });
await browser.close();
