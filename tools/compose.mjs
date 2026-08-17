/**
 * Собирает один аннотированный композит ДО/ПОСЛЕ из двух кадров.
 * Рендерит HTML-шаблон в headless-браузере и снимает его целиком.
 *
 * zones: [{label, x, y, w, h}] — вырезки 1:1 из обоих кадров, по ряду на зону.
 * Без zones показывает кадры целиком.
 */
import puppeteer from "puppeteer";
import { readFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { OUT } from "./probe.mjs";

const asDataUri = async (file) =>
  `data:image/png;base64,${(await readFile(file)).toString("base64")}`;

export async function compose({ title, note, before, after, out, zones, scale = 1 }) {
  // Зона может принести свою пару кадров — так в один композит попадают
  // несколько независимых правок.
  const cache = new Map();
  const uri = async (file) => {
    if (!cache.has(file)) cache.set(file, await asDataUri(file));
    return cache.get(file);
  };

  const pane = (uri, zone) => {
    if (!zone) return `<img class="full" src="${uri}">`;
    return `<div class="crop" style="width:${zone.w * scale}px;height:${zone.h * scale}px">
      <img style="left:${-zone.x * scale}px;top:${-zone.y * scale}px;transform:scale(${scale});" src="${uri}">
    </div>`;
  };

  const rows = (
    await Promise.all(
      (zones ?? [null]).map(async (zone) => {
        const b = await uri(zone?.before ?? before);
        const a = await uri(zone?.after ?? after);
        return `
      <div class="zone">
        ${zone?.label ? `<div class="zlabel">${zone.label}</div>` : ""}
        <div class="row">
          <div class="pane before"><div class="tag">ДО</div>${pane(b, zone)}</div>
          <div class="pane after"><div class="tag">ПОСЛЕ</div>${pane(a, zone)}</div>
        </div>
      </div>`;
      })
    )
  ).join("");

  const html = `<!doctype html><meta charset="utf-8"><style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { background:#0c1016; color:#e6ecf2;
           font-family:"SF Pro Text",-apple-system,system-ui,sans-serif;
           padding:34px 34px 30px; width:max-content; }
    h1 { font-size:26px; font-weight:600; letter-spacing:-0.01em; margin-bottom:8px; }
    .note { font-size:15px; line-height:1.55; color:#9fb0c0; max-width:1040px; margin-bottom:26px; }
    .zone + .zone { margin-top:22px; }
    .zlabel { font-size:12px; letter-spacing:0.14em; color:#6d7d8c; margin-bottom:9px;
              text-transform:uppercase; }
    .row { display:flex; gap:18px; }
    .pane { border:1px solid #232c38; border-radius:10px; overflow:hidden; background:#000; }
    .tag { font-size:11px; font-weight:700; letter-spacing:0.16em; padding:8px 13px;
           border-bottom:1px solid #232c38; }
    .before .tag { color:#ff9d7a; background:#22150f; }
    .after  .tag { color:#7fd4c1; background:#0f211d; }
    .crop { position:relative; overflow:hidden; }
    .crop img { position:absolute; transform-origin:0 0; display:block; }
    img.full { display:block; width:620px; height:auto; }
  </style>
  <h1>${title}</h1>
  <div class="note">${note}</div>
  ${rows}`;

  const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
  const page = await browser.newPage();
  await page.setViewport({ width: 2000, height: 1200, deviceScaleFactor: 2 });
  await page.setContent(html, { waitUntil: "load" });

  await mkdir(OUT, { recursive: true });
  const file = path.join(OUT, out);
  await (await page.$("body")).screenshot({ path: file });
  await browser.close();
  return file;
}
