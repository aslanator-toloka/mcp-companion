// Lightweight region proposals for high-contrast card title panels. This is only
// a browser OCR aid, not a claim that a card detector recognized an identity.
export function titleRegions({ data, width, height }) {
  const total = width * height,
    mask = new Uint8Array(total),
    seen = new Uint8Array(total);
  for (let i = 0; i < total; i++) {
    const p = i * 4,
      r = data[p],
      g = data[p + 1],
      b = data[p + 2];
    mask[i] =
      Math.min(r, g, b) > 242 && Math.max(r, g, b) - Math.min(r, g, b) < 12
        ? 1
        : 0;
  }
  const queue = new Int32Array(total),
    regions = [];
  for (let seed = 0; seed < total; seed++) {
    if (!mask[seed] || seen[seed]) continue;
    let head = 0,
      tail = 1,
      count = 0,
      x0 = width,
      y0 = height,
      x1 = 0,
      y1 = 0;
    queue[0] = seed;
    seen[seed] = 1;
    while (head < tail) {
      const p = queue[head++],
        x = p % width,
        y = (p / width) | 0;
      count++;
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
      const neighbours = [
        x > 0 ? p - 1 : -1,
        x + 1 < width ? p + 1 : -1,
        y > 0 ? p - width : -1,
        y + 1 < height ? p + width : -1,
      ];
      for (const n of neighbours)
        if (n >= 0 && mask[n] && !seen[n]) {
          seen[n] = 1;
          queue[tail++] = n;
        }
    }
    const w = x1 - x0 + 1,
      h = y1 - y0 + 1,
      area = w * h,
      ratio = w / h;
    if (
      count < 150 ||
      w < width * 0.06 ||
      h < height * 0.035 ||
      area > total * 0.22 ||
      count / area < 0.48 ||
      ratio < 0.45 ||
      ratio > 12
    )
      continue;
    const topHeight = Math.min(
      h,
      ratio > 4 ? h : Math.max(h * 0.36, Math.min(w * 0.35, h * 0.7)),
    );
    regions.push({
      x: Math.max(0, x0 - 3) / width,
      y: Math.max(0, y0 - 3) / height,
      w: Math.min(width - Math.max(0, x0 - 3), w + 6) / width,
      h: Math.min(height - Math.max(0, y0 - 3), topHeight + 6) / height,
      priority: count / area / Math.sqrt(area / total),
    });
  }
  regions.sort((a, b) => b.priority - a.priority);
  // A complete heading may be printed directly on a light crisis background.
  const top = { x: 0, y: 0, w: 1, h: 0.23, priority: 0 };
  return [...regions.slice(0, 8), top];
}

// OCR layout sometimes merges a whole row of adjacent cards into one line.
// Split those bands at genuinely empty columns, then read each title-sized piece.
export function textBandRegions({ data, width, height }, lines) {
  const bands = lines
    .filter((l) => l.box && l.box.h >= 0.025 && l.box.w >= 0.35)
    .sort(
      (a, b) =>
        (a.box.y < 0.12 ? -1 : 0) - (b.box.y < 0.12 ? -1 : 0) ||
        b.box.h - a.box.h,
    )
    .slice(0, 5);
  const regions = [];
  for (const line of bands) {
    const y = Math.max(0, Math.floor(line.box.y * height) - 2),
      h = Math.min(height - y, Math.ceil(line.box.h * height) + 4);
    const gap = Math.max(4, Math.round(h * 0.3));
    let start = -1,
      empty = 0;
    const add = (end) => {
      if (start < 0 || end - start < 12) return;
      regions.push({
        x: Math.max(0, start - 3) / width,
        y: y / height,
        w: Math.min(width - Math.max(0, start - 3), end - start + 6) / width,
        h: h / height,
      });
    };
    for (let x = 0; x < width; x++) {
      let dark = 0;
      for (let yy = y; yy < y + h; yy++) {
        const i = (yy * width + x) * 4;
        if (Math.max(data[i], data[i + 1], data[i + 2]) < 150) dark++;
      }
      if (dark > 1) {
        if (start < 0) start = x;
        empty = 0;
      } else if (start >= 0 && ++empty >= gap) {
        add(x - empty + 1);
        start = -1;
        empty = 0;
      }
    }
    if (start >= 0) add(width - empty);
  }
  return regions.filter((r) => r.w > 0.04).slice(0, 14);
}
