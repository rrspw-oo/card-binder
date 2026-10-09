import { createWorker, PSM } from "tesseract.js";
import { parseCode, matchName } from "./parse";

let codeWorker;
let nameWorker;

const getCodeWorker = () =>
  (codeWorker ||= createWorker("eng").then(async (w) => {
    await w.setParameters({
      tessedit_pageseg_mode: PSM.SINGLE_LINE,
      tessedit_char_whitelist: "0123456789/ ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz",
    });
    return w;
  }));

const getNameWorker = () =>
  (nameWorker ||= createWorker(["chi_tra", "jpn", "eng"]).then(async (w) => {
    await w.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_LINE });
    return w;
  }));

export const warmUp = () => Promise.all([getCodeWorker(), getNameWorker()]);

export function prepare(source, [x, y, w, h], scale, binarize) {
  const c = document.createElement("canvas");
  c.width = Math.round(w * scale);
  c.height = Math.round(h * scale);
  const ctx = c.getContext("2d", { willReadFrequently: true });
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, x, y, w, h, 0, 0, c.width, c.height);
  const data = ctx.getImageData(0, 0, c.width, c.height);
  const px = data.data;
  const gray = new Uint8Array(c.width * c.height);
  for (let i = 0; i < gray.length; i++) gray[i] = 0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2];
  let threshold = 128;
  if (binarize) {
    const hist = new Array(256).fill(0);
    for (const g of gray) hist[g]++;
    let sum = 0;
    let sumB = 0;
    let wB = 0;
    let best = 0;
    for (let t = 0; t < 256; t++) sum += t * hist[t];
    for (let t = 0; t < 256; t++) {
      wB += hist[t];
      if (!wB) continue;
      const wF = gray.length - wB;
      if (!wF) break;
      sumB += t * hist[t];
      const between = wB * wF * (sumB / wB - (sum - sumB) / wF) ** 2;
      if (between > best) {
        best = between;
        threshold = t;
      }
    }
  }
  let darkCount = 0;
  for (const g of gray) if (g < threshold) darkCount++;
  const invert = darkCount > gray.length / 2;
  for (let i = 0; i < gray.length; i++) {
    let v = binarize ? (gray[i] < threshold ? 0 : 255) : gray[i];
    if (invert) v = 255 - v;
    px[i * 4] = px[i * 4 + 1] = px[i * 4 + 2] = v;
  }
  ctx.putImageData(data, 0, 0);
  return c;
}

export const CODE_REGION = [0.02, 0.9, 0.45, 0.075];
export const NAME_REGION = [0.15, 0.02, 0.6, 0.075];

const regionOf = (card, [fx, fy, fw, fh]) => [fx * card.width, fy * card.height, fw * card.width, fh * card.height];

export async function readCard(card) {
  const [cw, nw] = await warmUp();
  let code = { number: "", total: "", rarity: "", setCode: "" };
  let codeText = "";
  for (const binarize of [false, true]) {
    const out = await cw.recognize(prepare(card, regionOf(card, CODE_REGION), 3, binarize));
    const parsed = parseCode(out.data.text);
    codeText = out.data.text.trim();
    if (parsed.number) {
      code = parsed;
      break;
    }
  }
  const nameOut = await nw.recognize(prepare(card, regionOf(card, NAME_REGION), 2, false));
  const name = matchName(nameOut.data.text);
  return { ...code, match: name, raw: { code: codeText, name: nameOut.data.text.trim() } };
}
