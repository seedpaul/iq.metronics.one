import { clamp } from "../engine/utils.js";

const DEFAULT_TINT = "#dbe7ff";

const TOKEN_LIBRARY = {
  sigil_orbit: { shape: "circle", fill: "none", mark: "dot", tint: "#7dd3fc", accent: "#e0f2fe" },
  sigil_beacon: { shape: "triangle", fill: "solid", mark: "slash", tint: "#93c5fd", accent: "#dbeafe" },
  sigil_frame: { shape: "square", fill: "none", mark: "bar", tint: "#c4b5fd", accent: "#ede9fe" },
  sigil_kite: { shape: "diamond", fill: "stripe", mark: "dot", tint: "#f9a8d4", accent: "#fce7f3" },
  sigil_pulse: { shape: "pill", fill: "solid", mark: "ring", rot: 90, tint: "#86efac", accent: "#dcfce7" },
  sigil_halo: { shape: "circle", fill: "stripe", mark: "ring", tint: "#fcd34d", accent: "#fef3c7" },
  sigil_prism: { shape: "hex", fill: "none", mark: "slash", tint: "#67e8f9", accent: "#cffafe" },
  sigil_axis: { shape: "diamond", fill: "solid", mark: "bar", tint: "#fdba74", accent: "#ffedd5" },
  sigil_nova: { shape: "star", fill: "none", mark: "dot", tint: "#fda4af", accent: "#ffe4e6" },
  sigil_arc: { shape: "triangle", fill: "mesh", mark: "chevron", rot: 180, tint: "#a5b4fc", accent: "#e0e7ff" },
  sigil_gate: { shape: "square", fill: "solid", mark: "ring", tint: "#5eead4", accent: "#ccfbf1" },
  sigil_quartz: { shape: "hex", fill: "mesh", mark: "dot", tint: "#f5d0fe", accent: "#fae8ff" }
};

function hashString(text){
  let value = 2166136261 >>> 0;
  for (let i = 0; i < text.length; i++){
    value ^= text.charCodeAt(i);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

function normalizeFill(fill){
  if (fill === "striped") return "stripe";
  return fill || "none";
}

function cloneDescriptor(desc){
  return JSON.parse(JSON.stringify(desc));
}

function fallbackDescriptor(token){
  const shapes = ["circle", "square", "triangle", "diamond", "hex", "pill"];
  const marks = ["dot", "ring", "slash", "bar", "chevron"];
  const fills = ["none", "solid", "stripe", "mesh"];
  const hash = hashString(String(token));
  return {
    shape: shapes[hash % shapes.length],
    fill: fills[(hash >>> 3) % fills.length],
    mark: marks[(hash >>> 5) % marks.length],
    rot: [0, 45, 90, 135, 180][(hash >>> 7) % 5],
    tint: `hsl(${hash % 360} 80% 76%)`,
    accent: `hsl(${(hash + 28) % 360} 100% 94%)`
  };
}

function resolveSymbol(sym){
  if (typeof sym === "string"){
    return cloneDescriptor(TOKEN_LIBRARY[sym] || fallbackDescriptor(sym));
  }
  if (sym && typeof sym === "object"){
    return {
      shape: sym.shape || "circle",
      fill: normalizeFill(sym.fill),
      rot: sym.rot || 0,
      count: sym.count || 1,
      invert: sym.invert || 0,
      mark: sym.mark || null,
      tint: sym.tint || DEFAULT_TINT,
      accent: sym.accent || "#f8fbff"
    };
  }
  return { shape: "circle", fill: "none", rot: 0, count: 1, tint: DEFAULT_TINT, accent: "#f8fbff" };
}

function getOffsets(count, radius){
  if (count <= 1) return [[0, 0]];
  if (count === 2) return [[-radius * 0.68, 0], [radius * 0.68, 0]];
  return [[-radius * 0.92, 0], [0, 0], [radius * 0.92, 0]];
}

function buildShapeMarkup(shape, radius){
  const r = radius;
  if (shape === "circle") return `<circle cx="0" cy="0" r="${(r * 0.82).toFixed(2)}"></circle>`;
  if (shape === "square") return `<rect x="${(-r * 0.78).toFixed(2)}" y="${(-r * 0.78).toFixed(2)}" width="${(r * 1.56).toFixed(2)}" height="${(r * 1.56).toFixed(2)}" rx="${(r * 0.22).toFixed(2)}"></rect>`;
  if (shape === "triangle") return `<path d="M 0 ${(-r * 0.96).toFixed(2)} L ${(r * 0.9).toFixed(2)} ${(r * 0.78).toFixed(2)} L ${(-r * 0.9).toFixed(2)} ${(r * 0.78).toFixed(2)} Z"></path>`;
  if (shape === "diamond") return `<path d="M 0 ${(-r).toFixed(2)} L ${r.toFixed(2)} 0 L 0 ${r.toFixed(2)} L ${(-r).toFixed(2)} 0 Z"></path>`;
  if (shape === "hex"){
    const points = [
      [0, -r], [r * 0.87, -r * 0.5], [r * 0.87, r * 0.5],
      [0, r], [-r * 0.87, r * 0.5], [-r * 0.87, -r * 0.5]
    ].map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
    return `<polygon points="${points}"></polygon>`;
  }
  if (shape === "pill") return `<rect x="${(-r).toFixed(2)}" y="${(-r * 0.58).toFixed(2)}" width="${(r * 2).toFixed(2)}" height="${(r * 1.16).toFixed(2)}" rx="${(r * 0.58).toFixed(2)}"></rect>`;
  if (shape === "star"){
    const points = [];
    for (let i = 0; i < 10; i++){
      const angle = -Math.PI / 2 + i * (Math.PI / 5);
      const rr = i % 2 === 0 ? r : r * 0.44;
      points.push(`${(Math.cos(angle) * rr).toFixed(2)},${(Math.sin(angle) * rr).toFixed(2)}`);
    }
    return `<polygon points="${points.join(" ")}"></polygon>`;
  }
  return `<circle cx="0" cy="0" r="${(r * 0.82).toFixed(2)}"></circle>`;
}

function buildPatternDefs(patternId, desc){
  if (desc.fill === "stripe"){
    return `
      <pattern id="${patternId}" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
        <rect width="8" height="8" fill="transparent"></rect>
        <line x1="0" y1="0" x2="0" y2="8" stroke="${desc.tint}" stroke-width="3" stroke-linecap="round"></line>
      </pattern>
    `;
  }
  if (desc.fill === "mesh"){
    return `
      <pattern id="${patternId}" width="10" height="10" patternUnits="userSpaceOnUse">
        <path d="M 0 5 L 10 5 M 5 0 L 5 10" stroke="${desc.tint}" stroke-width="1.7" stroke-linecap="round" opacity="0.82"></path>
      </pattern>
    `;
  }
  return "";
}

function buildMarkMarkup(desc, radius){
  const stroke = desc.accent || "#f8fbff";
  const r = radius;
  if (desc.mark === "dot") return `<circle cx="0" cy="0" r="${(r * 0.18).toFixed(2)}" fill="${stroke}"></circle>`;
  if (desc.mark === "ring") return `<circle cx="0" cy="0" r="${(r * 0.34).toFixed(2)}" fill="none" stroke="${stroke}" stroke-width="${(r * 0.12).toFixed(2)}"></circle>`;
  if (desc.mark === "slash") return `<path d="M ${(-r * 0.42).toFixed(2)} ${(r * 0.45).toFixed(2)} L ${(r * 0.42).toFixed(2)} ${(-r * 0.45).toFixed(2)}" fill="none" stroke="${stroke}" stroke-width="${(r * 0.16).toFixed(2)}" stroke-linecap="round"></path>`;
  if (desc.mark === "bar") return `<path d="M ${(-r * 0.48).toFixed(2)} 0 L ${(r * 0.48).toFixed(2)} 0" fill="none" stroke="${stroke}" stroke-width="${(r * 0.16).toFixed(2)}" stroke-linecap="round"></path>`;
  if (desc.mark === "chevron") return `<path d="M ${(-r * 0.34).toFixed(2)} ${(-r * 0.12).toFixed(2)} L 0 ${(r * 0.22).toFixed(2)} L ${(r * 0.34).toFixed(2)} ${(-r * 0.12).toFixed(2)}" fill="none" stroke="${stroke}" stroke-width="${(r * 0.14).toFixed(2)}" stroke-linecap="round" stroke-linejoin="round"></path>`;
  return "";
}

function buildSymbolGroupMarkup(desc, uid, cx, cy, radius){
  const offsets = getOffsets(desc.count || 1, radius);
  const fillRef = desc.fill === "solid"
    ? `rgba(255,255,255,${desc.invert ? 0.08 : 0.14})`
    : ((desc.fill === "stripe" || desc.fill === "mesh") ? `url(#${uid}-pattern)` : "transparent");
  const stroke = desc.invert ? "#08111f" : desc.tint || DEFAULT_TINT;
  const inner = offsets.map(([dx, dy]) => `
    <g transform="translate(${(cx + dx).toFixed(2)} ${(cy + dy).toFixed(2)}) rotate(${desc.rot || 0})">
      <g fill="${fillRef}" stroke="${stroke}" stroke-width="${Math.max(2.2, radius * 0.12).toFixed(2)}" stroke-linejoin="round" stroke-linecap="round">
        ${buildShapeMarkup(desc.shape, radius)}
      </g>
      ${buildMarkMarkup(desc, radius * 0.94)}
      <circle cx="0" cy="0" r="${(radius * 0.98).toFixed(2)}" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="1"></circle>
    </g>
  `).join("");

  return {
    defs: buildPatternDefs(`${uid}-pattern`, desc),
    markup: inner
  };
}

export function symbolToSvg(sym, size = 86){
  if (Array.isArray(sym)) return symbolPairToSvg(sym, size);

  const desc = resolveSymbol(sym);
  const uid = `sym-${hashString(`${JSON.stringify(desc)}-${size}`)}`;
  const s = size;
  const radius = s * 0.22;
  const { defs, markup } = buildSymbolGroupMarkup(desc, uid, s / 2, s / 2, radius);

  return `
    <svg width="${s}" height="${s}" viewBox="0 0 ${s} ${s}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id="${uid}-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="rgba(255,255,255,0.18)"></stop>
          <stop offset="100%" stop-color="rgba(255,255,255,0.04)"></stop>
        </linearGradient>
        ${defs}
      </defs>
      <rect x="4" y="4" width="${s - 8}" height="${s - 8}" rx="${Math.max(14, s * 0.16).toFixed(2)}" fill="url(#${uid}-bg)" stroke="rgba(255,255,255,0.12)"></rect>
      <rect x="7" y="7" width="${s - 14}" height="${s - 14}" rx="${Math.max(12, s * 0.14).toFixed(2)}" fill="rgba(6,12,24,0.4)" stroke="rgba(125,211,252,0.10)"></rect>
      ${markup}
    </svg>
  `;
}

export function symbolPairToSvg(pair, size = 86){
  const items = pair.slice(0, 2).map(resolveSymbol);
  const width = Math.round(size * 2.18);
  const height = size;
  const uid = `pair-${hashString(`${JSON.stringify(items)}-${size}`)}`;
  const left = buildSymbolGroupMarkup(items[0], `${uid}-a`, size * 0.58, size / 2, size * 0.2);
  const right = buildSymbolGroupMarkup(items[1], `${uid}-b`, size * 1.6, size / 2, size * 0.2);

  return `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id="${uid}-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="rgba(255,255,255,0.14)"></stop>
          <stop offset="100%" stop-color="rgba(255,255,255,0.04)"></stop>
        </linearGradient>
        ${left.defs}
        ${right.defs}
      </defs>
      <rect x="4" y="4" width="${width - 8}" height="${height - 8}" rx="${Math.max(14, size * 0.18).toFixed(2)}" fill="url(#${uid}-bg)" stroke="rgba(255,255,255,0.12)"></rect>
      <line x1="${(width / 2).toFixed(2)}" y1="18" x2="${(width / 2).toFixed(2)}" y2="${height - 18}" stroke="rgba(255,255,255,0.12)" stroke-dasharray="4 5"></line>
      ${left.markup}
      ${right.markup}
    </svg>
  `;
}

export function drawSymbolCanvas(ctx, sym, cx, cy, radius, opts = {}){
  const desc = resolveSymbol(sym);
  const drawPlate = opts.drawPlate !== false;
  const alpha = clamp(typeof opts.alpha === "number" ? opts.alpha : 1, 0.12, 1);
  const offsets = getOffsets(desc.count || 1, radius);

  ctx.save();
  ctx.globalAlpha = alpha;

  if (drawPlate){
    const plateW = radius * 3.05;
    const plateH = radius * 3.05;
    const plateX = cx - plateW / 2;
    const plateY = cy - plateH / 2;
    const gradient = ctx.createLinearGradient(plateX, plateY, plateX + plateW, plateY + plateH);
    gradient.addColorStop(0, "rgba(255,255,255,0.12)");
    gradient.addColorStop(1, "rgba(255,255,255,0.03)");
    ctx.fillStyle = gradient;
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = Math.max(1.5, radius * 0.08);
    ctx.beginPath();
    roundRect(ctx, plateX, plateY, plateW, plateH, radius * 0.52);
    ctx.fill();
    ctx.stroke();
  }

  for (const [dx, dy] of offsets){
    ctx.save();
    ctx.translate(cx + dx, cy + dy);
    ctx.rotate(((desc.rot || 0) * Math.PI) / 180);
    ctx.lineWidth = Math.max(2, radius * 0.13);
    ctx.strokeStyle = desc.invert ? "#08111f" : desc.tint || DEFAULT_TINT;
    ctx.fillStyle = desc.fill === "solid" ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0)";

    drawShapePath(ctx, desc.shape, radius * 0.92);
    ctx.fill();
    ctx.stroke();

    if (desc.fill === "stripe" || desc.fill === "mesh"){
      ctx.save();
      ctx.clip();
      ctx.strokeStyle = desc.tint || DEFAULT_TINT;
      ctx.globalAlpha = 0.8;
      const step = desc.fill === "mesh" ? radius * 0.34 : radius * 0.3;
      for (let pos = -radius * 1.8; pos <= radius * 1.8; pos += step){
        ctx.beginPath();
        ctx.moveTo(pos, -radius * 1.8);
        ctx.lineTo(pos + radius * 1.2, radius * 1.8);
        ctx.stroke();
        if (desc.fill === "mesh"){
          ctx.beginPath();
          ctx.moveTo(-radius * 1.8, pos);
          ctx.lineTo(radius * 1.8, pos);
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    drawCanvasMark(ctx, desc, radius * 0.94);
    ctx.restore();
  }

  ctx.restore();
}

export function renderSymbolGrid(canvas, symbols, cols = 2){
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  const rows = Math.ceil(symbols.length / cols);
  const cellW = w / cols;
  const cellH = h / rows;

  for (let i = 0; i < symbols.length; i++){
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x0 = col * cellW;
    const y0 = row * cellH;
    drawSymbolCanvas(ctx, symbols[i], x0 + cellW / 2, y0 + cellH / 2, Math.min(cellW, cellH) * 0.25, { drawPlate: true });
  }
}

function drawShapePath(ctx, shape, radius){
  const r = radius;
  ctx.beginPath();
  if (shape === "circle"){
    ctx.arc(0, 0, r * 0.82, 0, Math.PI * 2);
    return;
  }
  if (shape === "square"){
    roundRect(ctx, -r * 0.78, -r * 0.78, r * 1.56, r * 1.56, r * 0.22);
    return;
  }
  if (shape === "triangle"){
    ctx.moveTo(0, -r * 0.96);
    ctx.lineTo(r * 0.9, r * 0.78);
    ctx.lineTo(-r * 0.9, r * 0.78);
    ctx.closePath();
    return;
  }
  if (shape === "diamond"){
    ctx.moveTo(0, -r);
    ctx.lineTo(r, 0);
    ctx.lineTo(0, r);
    ctx.lineTo(-r, 0);
    ctx.closePath();
    return;
  }
  if (shape === "hex"){
    for (let i = 0; i < 6; i++){
      const angle = -Math.PI / 2 + i * (Math.PI / 3);
      const x = Math.cos(angle) * r;
      const y = Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    return;
  }
  if (shape === "pill"){
    roundRect(ctx, -r, -r * 0.58, r * 2, r * 1.16, r * 0.58);
    return;
  }
  if (shape === "star"){
    for (let i = 0; i < 10; i++){
      const angle = -Math.PI / 2 + i * (Math.PI / 5);
      const rr = i % 2 === 0 ? r : r * 0.44;
      const x = Math.cos(angle) * rr;
      const y = Math.sin(angle) * rr;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    return;
  }
  ctx.arc(0, 0, r * 0.82, 0, Math.PI * 2);
}

function drawCanvasMark(ctx, desc, radius){
  const r = radius;
  ctx.save();
  ctx.strokeStyle = desc.accent || "#f8fbff";
  ctx.fillStyle = desc.accent || "#f8fbff";
  ctx.lineWidth = Math.max(2, r * 0.16);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (desc.mark === "dot"){
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.18, 0, Math.PI * 2);
    ctx.fill();
  }else if (desc.mark === "ring"){
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.34, 0, Math.PI * 2);
    ctx.stroke();
  }else if (desc.mark === "slash"){
    ctx.beginPath();
    ctx.moveTo(-r * 0.42, r * 0.45);
    ctx.lineTo(r * 0.42, -r * 0.45);
    ctx.stroke();
  }else if (desc.mark === "bar"){
    ctx.beginPath();
    ctx.moveTo(-r * 0.48, 0);
    ctx.lineTo(r * 0.48, 0);
    ctx.stroke();
  }else if (desc.mark === "chevron"){
    ctx.beginPath();
    ctx.moveTo(-r * 0.34, -r * 0.12);
    ctx.lineTo(0, r * 0.22);
    ctx.lineTo(r * 0.34, -r * 0.12);
    ctx.stroke();
  }
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r){
  const rr = clamp(r, 0, Math.min(w, h) / 2);
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
