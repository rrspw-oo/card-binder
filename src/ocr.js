import { createWorker, PSM } from "tesseract.js";
import { parseCode, matchName } from "./parse";

let codeWorker;
const nameWorkers = {};
const NAME_LANGS = ["chi_tra", "jpn", "eng"];

const getCodeWorker = () =>
  (codeWorker ||= createWorker("eng").then(async (w) => {
    await w.setParameters({
      tessedit_pageseg_mode: PSM.SPARSE_TEXT,
      tessedit_char_whitelist: "0123456789/ ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz",
    });
    return w;
  }));

const getNameWorker = (lang) =>
  (nameWorkers[lang] ||= createWorker(lang).then(async (w) => {
    await w.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT });
    return w;
  }));

export const warmUp = () => Promise.all([getCodeWorker(), getNameWorker(NAME_LANGS[0])]);

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

export const CODE_REGION = [0, 0.85, 0.62, 0.15];
export const NAME_REGION = [0.08, 0.01, 0.76, 0.09];

const regionOf = (card, [fx, fy, fw, fh]) => [fx * card.width, fy * card.height, fw * card.width, fh * card.height];

export async function readCard(card) {
  const [cw] = await warmUp();
  let code = { number: "", total: "", rarity: "", setCode: "" };
  let codeText = "";
  for (const binarize of [false, true]) {
    const out = await cw.recognize(prepare(card, regionOf(card, CODE_REGION), 3, binarize));
    const parsed = parseCode(out.data.text);
    if (parsed.number && (!code.number || parsed.full)) {
      code = parsed;
      codeText = out.data.text.trim();
    }
    if (code.full) break;
  }
  const nameCanvas = prepare(card, regionOf(card, NAME_REGION), 2, false);
  let match = null;
  let nameText = "";
  for (const lang of NAME_LANGS) {
    const out = await (await getNameWorker(lang)).recognize(nameCanvas);
    const found = matchName(out.data.text);
    if (found && (!match || found.score > match.score)) {
      match = found;
      nameText = out.data.text.trim();
    }
    if (match && match.score >= 0.75) break;
  }
  const { full, ...fields } = code;
  if (!full && fields.total.length === 3) fields.number = "";
  return { ...fields, match, raw: { code: codeText, name: nameText } };
}
