const CARD_RATIO = 63 / 88;

function blur(src, w, h) {
  const tmp = new Float32Array(w * h);
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0;
      let n = 0;
      for (let k = -2; k <= 2; k++) {
        const xx = x + k;
        if (xx >= 0 && xx < w) {
          s += src[y * w + xx];
          n++;
        }
      }
      tmp[y * w + x] = s / n;
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0;
      let n = 0;
      for (let k = -2; k <= 2; k++) {
        const yy = y + k;
        if (yy >= 0 && yy < h) {
          s += tmp[yy * w + x];
          n++;
        }
      }
      out[y * w + x] = s / n;
    }
  }
  return out;
}

function gradients(g, w, h) {
  const gx = new Float32Array(w * h);
  const gy = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      gx[i] = g[i - w + 1] + 2 * g[i + 1] + g[i + w + 1] - g[i - w - 1] - 2 * g[i - 1] - g[i + w - 1];
      gy[i] = g[i + w - 1] + 2 * g[i + w] + g[i + w + 1] - g[i - w - 1] - 2 * g[i - w] - g[i - w + 1];
    }
  }
  return { gx, gy };
}

function edgePoints(gx, gy, w, h, vertical, threshold) {
  const pts = [];
  const lines = vertical ? h : w;
  const span = vertical ? w : h;
  let scanlines = 0;
  for (let l = 2; l < lines - 2; l += 2) {
    scanlines++;
    const at = (d) => {
      const i = vertical ? l * w + d : d * w + l;
      const along = Math.abs(vertical ? gx[i] : gy[i]);
      const across = Math.abs(vertical ? gy[i] : gx[i]);
      return along > across * 1.2 ? along : 0;
    };
    for (let d = 2; d < span - 2; d++) {
      const v = at(d);
      if (v > threshold && v >= at(d - 1) && v > at(d + 1)) pts.push(vertical ? [d, l] : [l, d]);
    }
  }
  return { pts, scanlines };
}

const SLOPE = 0.35;
const SLOPE_STEP = 0.01;

function houghLines({ pts, scanlines }, vertical, w, h, limit) {
  const along = vertical ? h : w;
  const across = vertical ? w : h;
  const mid = along / 2;
  const slopes = Math.round((2 * SLOPE) / SLOPE_STEP) + 1;
  const off = Math.ceil(SLOPE * mid) + 2;
  const bins = across + 2 * off;
  const acc = new Uint16Array(slopes * bins);
  for (const p of pts) {
    const u = vertical ? p[1] : p[0];
    const v = vertical ? p[0] : p[1];
    for (let k = 0; k < slopes; k++) {
      const m = -SLOPE + k * SLOPE_STEP;
      const c = Math.round(v - m * (u - mid)) + off;
      acc[k * bins + c]++;
    }
  }
  const minVotes = Math.max(12, scanlines * 0.08);
  const peaks = [];
  for (let k = 0; k < slopes; k++) {
    for (let c = 1; c < bins - 1; c++) {
      const val = acc[k * bins + c];
      if (val < minVotes) continue;
      let isMax = true;
      for (let dk = -1; dk <= 1 && isMax; dk++) {
        const kk = k + dk;
        if (kk < 0 || kk >= slopes) continue;
        for (let dc = -2; dc <= 2; dc++) {
          if (!dk && !dc) continue;
          const other = acc[kk * bins + c + dc];
          if (other > val || (other === val && (dk < 0 || (dk === 0 && dc < 0)))) {
            isMax = false;
            break;
          }
        }
      }
      if (isMax) peaks.push({ votes: val, m: -SLOPE + k * SLOPE_STEP, c0: c - off });
    }
  }
  peaks.sort((a, b) => b.votes - a.votes);
  const lines = [];
  for (const pk of peaks) {
    if (lines.length >= limit) break;
    const at = (line, u) => line.c0 + line.m * (u - mid);
    if (lines.some((l) => Math.abs(at(l, 0) - at(pk, 0)) < 3 && Math.abs(at(l, along) - at(pk, along)) < 3)) continue;
    let su = 0;
    let sv = 0;
    let suu = 0;
    let suv = 0;
    let n = 0;
    for (const p of pts) {
      const u = vertical ? p[1] : p[0];
      const v = vertical ? p[0] : p[1];
      if (Math.abs(v - at(pk, u)) > 2) continue;
      su += u;
      sv += v;
      suu += u * u;
      suv += u * v;
      n++;
    }
    if (n < minVotes) continue;
    const m = (n * suv - su * sv) / (n * suu - su * su || 1);
    const c = (sv - m * su) / n;
    lines.push({ vertical, m, c, c0: c + m * mid });
  }
  return lines;
}

function intersect(v, hz) {
  const y = (hz.m * v.c + hz.c) / (1 - hz.m * v.m);
  return [v.m * y + v.c, y];
}

function profile(line, gx, gy, w, h, threshold) {
  const along = line.vertical ? h : w;
  const len = Math.hypot(1, line.m);
  const dx = line.vertical ? line.m / len : 1 / len;
  const dy = line.vertical ? 1 / len : line.m / len;
  const nx = -dy;
  const ny = dx;
  const hit = new Int32Array(along + 1);
  const valid = new Int32Array(along + 1);
  for (let u = 0; u < along; u++) {
    const v = line.m * u + line.c;
    const x0 = line.vertical ? v : u;
    const y0 = line.vertical ? u : v;
    let best = -1;
    for (const o of [-1.5, -0.75, 0, 0.75, 1.5]) {
      const xi = Math.round(x0 + nx * o);
      const yi = Math.round(y0 + ny * o);
      if (xi < 1 || yi < 1 || xi >= w - 1 || yi >= h - 1) continue;
      const i = yi * w + xi;
      const normal = Math.abs(gx[i] * nx + gy[i] * ny);
      const tangent = Math.abs(gx[i] * ny - gy[i] * nx);
      best = Math.max(best, normal > tangent ? normal : 0);
    }
    hit[u + 1] = hit[u] + (best > threshold ? 1 : 0);
    valid[u + 1] = valid[u] + (best >= 0 ? 1 : 0);
  }
  return { hit, valid, along };
}

function rangeRatio(pr, a, b) {
  const lo = Math.max(0, Math.min(pr.along, Math.round(Math.min(a, b))));
  const hi = Math.max(0, Math.min(pr.along, Math.round(Math.max(a, b))));
  const n = pr.valid[hi] - pr.valid[lo];
  return n > 0 ? [(pr.hit[hi] - pr.hit[lo]) / n, n] : [0, 0];
}

function offsetLine(line, d) {
  return { vertical: line.vertical, m: line.m, c: line.c + d * Math.hypot(1, line.m) };
}

const OFFSETS = [-5, -3, 3, 5];
const RATIO_MAX = 0.08;

function sideScore(line, a, b) {
  const len = b - a;
  const [cover] = rangeRatio(line.pr, a + 0.08 * len, b - 0.08 * len);
  const [endA] = rangeRatio(line.pr, a + 0.03 * len, a + 0.12 * len);
  const [endB] = rangeRatio(line.pr, b - 0.12 * len, b - 0.03 * len);
  const extOf = (pr) => {
    const [e1, n1] = rangeRatio(pr, a - 0.25 * len, a - 0.04 * len);
    const [e2, n2] = rangeRatio(pr, b + 0.04 * len, b + 0.25 * len);
    return n1 + n2 > 0 ? (e1 * n1 + e2 * n2) / (n1 + n2) : 0;
  };
  const ext = extOf(line.pr);
  const bg = line.off.reduce((s, pr) => s + extOf(pr), 0) / line.off.length;
  return { cover, ends: Math.min(endA, endB), ext, extSpec: Math.max(0, ext - bg) };
}

const area = (q) => {
  let s = 0;
  for (let i = 0; i < 4; i++) {
    const [x1, y1] = q[i];
    const [x2, y2] = q[(i + 1) % 4];
    s += x1 * y2 - x2 * y1;
  }
  return s / 2;
};

function quadGeometry(l, r, t, b) {
  const quad = [intersect(l, t), intersect(r, t), intersect(r, b), intersect(l, b)];
  const width = (Math.hypot(quad[1][0] - quad[0][0], quad[1][1] - quad[0][1]) + Math.hypot(quad[2][0] - quad[3][0], quad[2][1] - quad[3][1])) / 2;
  const height = (Math.hypot(quad[3][0] - quad[0][0], quad[3][1] - quad[0][1]) + Math.hypot(quad[2][0] - quad[1][0], quad[2][1] - quad[1][1])) / 2;
  return { quad, ratio: width / height / CARD_RATIO };
}

function insetCover(gx, gy, w, h, quad, width, beta) {
  const cx = quad.reduce((s, p) => s + p[0], 0) / 4;
  const cy = quad.reduce((s, p) => s + p[1], 0) / 4;
  let total = 0;
  for (let i = 0; i < 4; i++) {
    const p = quad[i];
    const q = quad[(i + 1) % 4];
    const dx = q[0] - p[0];
    const dy = q[1] - p[1];
    const len = Math.hypot(dx, dy);
    let nx = -dy / len;
    let ny = dx / len;
    if ((cx - p[0]) * nx + (cy - p[1]) * ny < 0) {
      nx = -nx;
      ny = -ny;
    }
    const d = beta * width;
    let hit = 0;
    let n = 0;
    for (let t = 0.12; t <= 0.88; t += 0.02) {
      const x0 = p[0] + dx * t + nx * d;
      const y0 = p[1] + dy * t + ny * d;
      let ok = false;
      let inside = false;
      for (const o of [-0.75, 0, 0.75]) {
        const xi = Math.round(x0 + nx * o);
        const yi = Math.round(y0 + ny * o);
        if (xi < 1 || yi < 1 || xi >= w - 1 || yi >= h - 1) continue;
        inside = true;
        const k = yi * w + xi;
        const normal = Math.abs(gx[k] * nx + gy[k] * ny);
        const tangent = Math.abs(gx[k] * ny - gy[k] * nx);
        if (normal > 14 && normal > tangent) ok = true;
      }
      if (!inside) continue;
      n++;
      if (ok) hit++;
    }
    total += n ? hit / n : 0;
  }
  return total / 4;
}

function cornerArc(gx, gy, w, h, quad, width) {
  let total = 0;
  for (let i = 0; i < 4; i++) {
    const c = quad[i];
    const p = quad[(i + 1) % 4];
    const q = quad[(i + 3) % 4];
    const lu = Math.hypot(p[0] - c[0], p[1] - c[1]);
    const lv = Math.hypot(q[0] - c[0], q[1] - c[1]);
    const u = [(p[0] - c[0]) / lu, (p[1] - c[1]) / lu];
    const v = [(q[0] - c[0]) / lv, (q[1] - c[1]) / lv];
    let best = 0;
    for (const rf of [0.035, 0.045, 0.055]) {
      const r = rf * width;
      if (r < 3) continue;
      const cx = c[0] + r * (u[0] + v[0]);
      const cy = c[1] + r * (u[1] + v[1]);
      let hit = 0;
      let n = 0;
      for (let a = 15; a <= 75; a += 7.5) {
        const t = (a * Math.PI) / 180;
        const nx = -(Math.cos(t) * u[0] + Math.sin(t) * v[0]);
        const ny = -(Math.cos(t) * u[1] + Math.sin(t) * v[1]);
        let ok = false;
        let inside = false;
        for (const o of [-1, 0, 1]) {
          const xi = Math.round(cx + nx * (r + o));
          const yi = Math.round(cy + ny * (r + o));
          if (xi < 1 || yi < 1 || xi >= w - 1 || yi >= h - 1) continue;
          inside = true;
          const k = yi * w + xi;
          const normal = Math.abs(gx[k] * nx + gy[k] * ny);
          const tangent = Math.abs(gx[k] * ny - gy[k] * nx);
          if (normal > 14 && normal > tangent) ok = true;
        }
        if (!inside) continue;
        n++;
        if (ok) hit++;
      }
      if (n) best = Math.max(best, hit / n);
    }
    total += best;
  }
  return total / 4;
}

export function detectCard(rgba, w, h, top = 200) {
  const gray = new Float32Array(w * h);
  for (let i = 0; i < gray.length; i++) gray[i] = 0.299 * rgba[i * 4] + 0.587 * rgba[i * 4 + 1] + 0.114 * rgba[i * 4 + 2];
  const { gx, gy } = gradients(blur(gray, w, h), w, h);
  const vLines = houghLines(edgePoints(gx, gy, w, h, true, 14), true, w, h, 24);
  const hLines = houghLines(edgePoints(gx, gy, w, h, false, 14), false, w, h, 24);
  for (const l of [...vLines, ...hLines]) {
    l.pr = profile(l, gx, gy, w, h, 14);
    l.off = OFFSETS.map((d) => profile(offsetLine(l, d), gx, gy, w, h, 14));
  }
  const margin = 0.03 * w;
  const pool = [];
  for (const l of vLines) {
    for (const r of vLines) {
      if (r.c0 - l.c0 < w * 0.25) continue;
      for (const t of hLines) {
        for (const b of hLines) {
          if (b.c0 - t.c0 < h * 0.25) continue;
          const { quad, ratio } = quadGeometry(l, r, t, b);
          if (Math.abs(Math.log(ratio)) > RATIO_MAX) continue;
          if (quad.some(([x, y]) => x < -margin || y < -margin || x > w + margin || y > h + margin)) continue;
          const a = area(quad) / (w * h);
          if (a < 0.12) continue;
          const sides = [sideScore(t, quad[0][0], quad[1][0]), sideScore(r, quad[1][1], quad[2][1]), sideScore(b, quad[3][0], quad[2][0]), sideScore(l, quad[0][1], quad[3][1])];
          const coverMin = Math.min(...sides.map((s) => s.cover));
          if (coverMin < 0.5) continue;
          const mean = (k) => sides.reduce((s, x) => s + x[k], 0) / 4;
          const score = mean("cover") + 0.5 * coverMin + 0.5 * mean("ends") - mean("extSpec") - 3 * Math.abs(Math.log(ratio)) + 0.3 * a;
          pool.push({ quad, score });
        }
      }
    }
  }
  pool.sort((x, y) => y.score - x.score);
  let best = null;
  for (const cand of pool.slice(0, top)) {
    const width = Math.hypot(cand.quad[1][0] - cand.quad[0][0], cand.quad[1][1] - cand.quad[0][1]);
    let border = 0;
    for (let beta = 0.02; beta <= 0.05 + 1e-9; beta += 0.0025) border = Math.max(border, insetCover(gx, gy, w, h, cand.quad, width, beta));
    cand.final = cand.score + cornerArc(gx, gy, w, h, cand.quad, width) + 2 * border;
    if (!best || cand.final > best.final) best = cand;
  }
  return best ? best.quad : null;
}

function homography(src, dst) {
  const a = [];
  const b = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i];
    const [u, v] = dst[i];
    a.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    b.push(u);
    a.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    b.push(v);
  }
  for (let col = 0; col < 8; col++) {
    let pivot = col;
    for (let r = col + 1; r < 8; r++) if (Math.abs(a[r][col]) > Math.abs(a[pivot][col])) pivot = r;
    [a[col], a[pivot]] = [a[pivot], a[col]];
    [b[col], b[pivot]] = [b[pivot], b[col]];
    for (let r = 0; r < 8; r++) {
      if (r === col) continue;
      const f = a[r][col] / a[col][col];
      for (let k = col; k < 8; k++) a[r][k] -= f * a[col][k];
      b[r] -= f * b[col];
    }
  }
  return b.map((v, i) => v / a[i][i]).concat(1);
}

export function expandQuad(quad, amount) {
  const cx = quad.reduce((s, p) => s + p[0], 0) / 4;
  const cy = quad.reduce((s, p) => s + p[1], 0) / 4;
  return quad.map(([x, y]) => [cx + (x - cx) * (1 + amount), cy + (y - cy) * (1 + amount)]);
}

export function warpCard(rgba, sw, sh, quad, dw, dh) {
  const H = homography(
    [
      [0, 0],
      [dw, 0],
      [dw, dh],
      [0, dh],
    ],
    quad,
  );
  const out = new Uint8ClampedArray(dw * dh * 4);
  for (let y = 0; y < dh; y++) {
    for (let x = 0; x < dw; x++) {
      const z = H[6] * x + H[7] * y + H[8];
      const sx = (H[0] * x + H[1] * y + H[2]) / z;
      const sy = (H[3] * x + H[4] * y + H[5]) / z;
      const x0 = Math.floor(sx);
      const y0 = Math.floor(sy);
      const o = (y * dw + x) * 4;
      if (x0 < 0 || y0 < 0 || x0 >= sw - 1 || y0 >= sh - 1) {
        out[o + 3] = 255;
        continue;
      }
      const fx = sx - x0;
      const fy = sy - y0;
      const i00 = (y0 * sw + x0) * 4;
      const i10 = i00 + 4;
      const i01 = i00 + sw * 4;
      const i11 = i01 + 4;
      for (let c = 0; c < 3; c++) {
        const top = rgba[i00 + c] * (1 - fx) + rgba[i10 + c] * fx;
        const bottom = rgba[i01 + c] * (1 - fx) + rgba[i11 + c] * fx;
        out[o + c] = top * (1 - fy) + bottom * fy;
      }
      out[o + 3] = 255;
    }
  }
  return out;
}
