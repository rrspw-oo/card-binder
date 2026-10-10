import { parseCode, matchName, parseDex, detectLang, nameOfDex, parseSetCode } from "./parse";
import { detectCard, warpCard, expandQuad } from "./cardDetect";

const DETECT_W = 320;
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

export const warmUp = () => run(null);

const toBuffer = async (canvas) => (await new Promise((r) => canvas.toBlob(r, "image/jpeg", 0.9))).arrayBuffer();

export function straighten(frame) {
  const sw = DETECT_W;
  const sh = Math.round((frame.height * DETECT_W) / frame.width);
  const small = document.createElement("canvas");
  small.width = sw;
  small.height = sh;
  const sctx = small.getContext("2d", { willReadFrequently: true });
  sctx.drawImage(frame, 0, 0, sw, sh);
  const px = sctx.getImageData(0, 0, sw, sh).data;
  const gray = new Float32Array(sw * sh);
  for (let i = 0; i < gray.length; i++) gray[i] = 0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2];
  const quad = detectCard(gray, sw, sh);
  if (!quad) return null;
  const s = frame.width / sw;
  const src = frame.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, frame.width, frame.height).data;
  const out = warpCard(src, frame.width, frame.height, expandQuad(quad.map(([x, y]) => [x * s, y * s]), 0.03), CARD_W, CARD_H);
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
  return { ...fields, setCode: parseSetCode(text, knownSets), lang, match, raw: text, seconds: (performance.now() - started) / 1000, passes, loadSeconds };
}
