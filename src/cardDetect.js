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

function sidePoints(gx, gy, w, h, side) {
  const vertical = side === "left" || side === "right";
  const lines = vertical ? h : w;
  const depth = Math.floor((vertical ? w : h) * 0.42);
  const pts = [];
  let scanlines = 0;
  for (let l = Math.floor(lines * 0.12); l < lines * 0.88; l += 2) {
    scanlines++;
    const at = (d) => {
      const x = vertical ? (side === "left" ? d : w - 1 - d) : l;
      const y = vertical ? l : side === "top" ? d : h - 1 - d;
      const i = y * w + x;
      const along = Math.abs(vertical ? gx[i] : gy[i]);
      const across = Math.abs(vertical ? gy[i] : gx[i]);
      return along > across * 1.2 ? along : 0;
    };
    for (let d = 3; d < depth - 1; d++) {
      const v = at(d);
      if (v > 24 && v >= at(d - 1) && v >= at(d + 1)) {
        const x = vertical ? (side === "left" ? d : w - 1 - d) : l;
        const y = vertical ? l : side === "top" ? d : h - 1 - d;
        pts.push([x, y, d]);
      }
    }
  }
  return { pts, scanlines };
}

function ransac(pts, vertical, rand) {
  let best = null;
  for (let it = 0; it < 300; it++) {
    const a = pts[Math.floor(rand() * pts.length)];
    const b = pts[Math.floor(rand() * pts.length)];
    const span = vertical ? b[1] - a[1] : b[0] - a[0];
    if (Math.abs(span) < 20) continue;
    const slope = vertical ? (b[0] - a[0]) / span : (b[1] - a[1]) / span;
    if (Math.abs(slope) > 0.35) continue;
    const inliers = pts.filter((p) => {
      const pred = vertical ? a[0] + slope * (p[1] - a[1]) : a[1] + slope * (p[0] - a[0]);
      return Math.abs((vertical ? p[0] : p[1]) - pred) < 2;
    });
    if (!best || inliers.length > best.length) best = inliers;
  }
  return best;
}

function fitLine({ pts, scanlines }, vertical) {
  let seed = 12345;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  let rest = pts;
  let chosen = null;
  for (let k = 0; k < 4 && rest.length >= 12; k++) {
    const inliers = ransac(rest, vertical, rand);
    if (!inliers) break;
    const support = new Set(inliers.map((p) => (vertical ? p[1] : p[0]))).size;
    if (support >= scanlines * 0.3) {
      const depth = inliers.reduce((sum, p) => sum + p[2], 0) / inliers.length;
      if (!chosen || depth < chosen.depth) chosen = { inliers, depth };
    }
    const used = new Set(inliers);
    rest = rest.filter((p) => !used.has(p));
  }
  if (!chosen) return null;
  const best = chosen.inliers;
  const n = best.length;
  let su = 0;
  let sv = 0;
  let suu = 0;
  let suv = 0;
  for (const [x, y] of best) {
    const u = vertical ? y : x;
    const v = vertical ? x : y;
    su += u;
    sv += v;
    suu += u * u;
    suv += u * v;
  }
  const m = (n * suv - su * sv) / (n * suu - su * su || 1);
  const c = (sv - m * su) / n;
  return { vertical, m, c };
}

function intersect(a, b) {
  const v = a.vertical ? a : b;
  const hz = a.vertical ? b : a;
  const y = (hz.m * v.c + hz.c) / (1 - hz.m * v.m);
  const x = v.m * y + v.c;
  return [x, y];
}

const area = (q) => {
  let s = 0;
  for (let i = 0; i < 4; i++) {
    const [x1, y1] = q[i];
    const [x2, y2] = q[(i + 1) % 4];
    s += x1 * y2 - x2 * y1;
  }
  return Math.abs(s) / 2;
};

export function detectCard(gray, w, h) {
  const { gx, gy } = gradients(blur(gray, w, h), w, h);
  const lines = {};
  for (const side of ["left", "right", "top", "bottom"]) {
    lines[side] = fitLine(sidePoints(gx, gy, w, h, side), side === "left" || side === "right");
    if (!lines[side]) return null;
  }
  const quad = [
    intersect(lines.left, lines.top),
    intersect(lines.right, lines.top),
    intersect(lines.right, lines.bottom),
    intersect(lines.left, lines.bottom),
  ];
  const width = (Math.hypot(quad[1][0] - quad[0][0], quad[1][1] - quad[0][1]) + Math.hypot(quad[2][0] - quad[3][0], quad[2][1] - quad[3][1])) / 2;
  const height = (Math.hypot(quad[3][0] - quad[0][0], quad[3][1] - quad[0][1]) + Math.hypot(quad[2][0] - quad[1][0], quad[2][1] - quad[1][1])) / 2;
  const ratio = width / height;
  if (area(quad) < w * h * 0.25) return null;
  if (ratio < CARD_RATIO * 0.8 || ratio > CARD_RATIO * 1.25) return null;
  return quad;
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
