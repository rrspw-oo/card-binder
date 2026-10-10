import { parseCode, matchName, parseDex, detectLang, nameOfDex, parseSetCode } from "./parse";
import { detectCard, warpCard, expandQuad } from "./cardDetect";

const DETECT_W = 240;
const LIVE_CANDIDATES = 30;
const CARD_W = 900;
const CARD_H = Math.round((CARD_W * 88) / 63);

let worker;
let seq = 0;
let loadSeconds = 0;
const pending = new Map();

function getWorker() {
  if (!worker) {
    worker = new Worker(new URL("./ocrWorker.js", import.meta.url), { type: "module" });
    worker.onmessage = ({ data }) => {
      const job = pending.get(data.id);
      pending.delete(data.id);
      if (data.error) job.reject(new Error(data.error));
      else {
        loadSeconds = data.loadSeconds || loadSeconds;
        job.resolve(data.text);
      }
    };
  }
  return worker;
}

const run = (image) =>
  new Promise((resolve, reject) => {
    const id = ++seq;
    pending.set(id, { resolve, reject });
    getWorker().postMessage({ id, image }, image ? [image] : []);
  });

let ready = false;

export const warmUp = () => run(null).then(() => {
  ready = true;
});

export const isReady = () => ready;

const toBuffer = async (canvas) => (await new Promise((r) => canvas.toBlob(r, "image/jpeg", 0.9))).arrayBuffer();

function pixelsOf(source, [x, y, w, h], sw) {
  const sh = Math.round((h * sw) / w);
  const small = document.createElement("canvas");
  small.width = sw;
  small.height = sh;
  const ctx = small.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(source, x, y, w, h, 0, 0, sw, sh);
  return { rgba: ctx.getImageData(0, 0, sw, sh).data, sw, sh };
}

export function locate(source, rect) {
  const { rgba, sw, sh } = pixelsOf(source, rect, DETECT_W);
  const quad = detectCard(rgba, sw, sh, LIVE_CANDIDATES);
  return quad && quad.map(([x, y]) => [x / sw, y / sh]);
}

export function straighten(frame) {
  const { rgba, sw, sh } = pixelsOf(frame, [0, 0, frame.width, frame.height], DETECT_W);
  const quad = detectCard(rgba, sw, sh);
  if (!quad) return null;
  const s = frame.width / sw;
  const src = frame.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, frame.width, frame.height).data;
  const out = warpCard(src, frame.width, frame.height, expandQuad(quad.map(([x, y]) => [x * s, y * s]), 0.015), CARD_W, CARD_H);
  const c = document.createElement("canvas");
  c.width = CARD_W;
  c.height = CARD_H;
  c.getContext("2d").putImageData(new ImageData(out, CARD_W, CARD_H), 0, 0);
  return c;
}

export async function readCard(card, frame, knownSets = []) {
  await warmUp();
  const started = performance.now();
  let passes = 1;
  let text = await run(await toBuffer(card));
  let code = parseCode(text);
  if (!code.full && frame && frame !== card) {
    const second = await run(await toBuffer(frame));
    passes++;
    const parsed = parseCode(second);
    if (parsed.full) code = parsed;
    text += `\n${second}`;
  }
  const lang = detectLang(text);
  const dex = parseDex(text);
  const match = dex ? { dex, lang: lang || "zh", name: nameOfDex(dex, lang || "zh") } : matchName(text);
  const { full, ...fields } = code;
  if (!full && fields.total.length === 3) fields.number = "";
  const set = parseSetCode(text, knownSets);
  console.info(`[ocr] ${((performance.now() - started) / 1000).toFixed(1)}s, ${passes} pass(es), model load ${loadSeconds.toFixed(1)}s`);
  return { ...fields, setCode: set.code, setCandidates: set.candidates, lang, match, raw: text, seconds: (performance.now() - started) / 1000, passes, loadSeconds };
}
