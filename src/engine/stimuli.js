import { clamp } from './utils.js';

function svgFromString(svgText){
  const tpl = document.createElement('template');
  tpl.innerHTML = svgText.trim();
  const el = tpl.content.firstElementChild;
  if (el && el.tagName && el.tagName.toLowerCase() === 'svg') return el;
  // fallback: wrap in svg
  const svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
  return svg;
}


/**
 * Create visuals / interactive panels per item type.
 * All stimuli are original and generated, not copied from proprietary tests.
 */
export function makeStimulus(node, item, session){

  // Pre-rendered SVG stem items (from large banks)
  if (item.type === 'mcq_svg' && item.stemSvg){
    const wrap = document.createElement('div');
    wrap.className = 'svgStem';
    wrap.appendChild(svgFromString(item.stemSvg));
    return wrap;
  }

  if (item.stimulusType === 'matrix' || item.kind === 'matrix'){
    
    return renderMatrix(item);
  }

  if (item.stimulusType === 'spatial-rotate' || item.kind === 'spatial-rotate'){
    
    return renderSpatial(item);
  }

  if (item.type === 'speed-symbol-search'){
    return renderSymbolSearch(node, item, session);
  }

  if (item.type === 'speed-coding'){
    return renderCoding(node, item, session);
  }

  return null;
}

function svgEl(tag, attrs={}){
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const k in attrs) el.setAttribute(k, String(attrs[k]));
  return el;
}

function renderMatrix(item){
  const wrap = document.createElement('div');

  const svg = svgEl('svg', { width: '100%', viewBox: '0 0 360 260', role: 'img', 'aria-label': 'Matrix puzzle' });
  svg.style.display = 'block';

  // 3x3 cells
  const cellW = 100, cellH = 70;
  const originX = 10, originY = 10;
  const gap = 10;

  const cells = item.matrix; // array length 9 with null for missing
  for (let r=0;r<3;r++){
    for (let c=0;c<3;c++){
      const idx = r*3+c;
      const x = originX + c*(cellW+gap);
      const y = originY + r*(cellH+gap);

      const rect = svgEl('rect', { x, y, width: cellW, height: cellH, rx: 10, fill: 'rgba(255,255,255,0.03)', stroke: 'rgba(34,48,83,1)' });
      svg.appendChild(rect);

      const cell = cells[idx];
      if (cell){
        drawGlyph(svg, x + cellW/2, y + cellH/2, cell);
      } else {
        const q = svgEl('text', { x: x+cellW/2, y: y+cellH/2+6, 'text-anchor':'middle', 'font-size':'28', fill: 'rgba(233,240,255,0.6)' });
        q.textContent = '?';
        svg.appendChild(q);
      }
    }
  }

  // choices below (A-H style)
  const choiceY = 235;
  const choices = item.choiceGlyphs; // array of glyph defs
  const labels = ['A','B','C','D','E','F','G','H'];
  const startX = 25;
  const dx = 42;

  choices.forEach((g, i) => {
    const x = startX + i*dx;
    const box = svgEl('rect', { x: x-16, y: choiceY-18, width: 32, height: 32, rx: 8, fill: 'rgba(255,255,255,0.02)', stroke: 'rgba(34,48,83,1)' });
    svg.appendChild(box);
    drawGlyph(svg, x, choiceY, g, 0.70);

    const t = svgEl('text', { x, y: choiceY+28, 'text-anchor':'middle', 'font-size':'11', fill:'rgba(169,182,214,1)' });
    t.textContent = labels[i];
    svg.appendChild(t);
  });

  wrap.appendChild(svg);
  return wrap;
}

function drawGlyph(svg, cx, cy, glyph, scale=1){
  // glyph: { shape: 'circle'|'triangle'|'square'|'plus'|'diamond', fill, rot, count, stroke, size }
  const g = svgEl('g', { transform: `translate(${cx},${cy}) rotate(${glyph.rot||0}) scale(${scale})` });
  svg.appendChild(g);

  const count = glyph.count || 1;
  const sep = 16;
  const baseX = -( (count-1) * sep ) / 2;

  for (let i=0;i<count;i++){
    const x = baseX + i*sep;

    const size = glyph.size || 18;
    const fill = glyph.fill || 'rgba(234,240,255,0.75)';
    const stroke = glyph.stroke || 'rgba(234,240,255,0.2)';

    if (glyph.shape === 'circle'){
      g.appendChild(svgEl('circle', { cx: x, cy: 0, r: size/2, fill, stroke }));
    } else if (glyph.shape === 'square'){
      g.appendChild(svgEl('rect', { x: x-size/2, y: -size/2, width: size, height: size, rx: 3, fill, stroke }));
    } else if (glyph.shape === 'diamond'){
      const p = `${x},${-size/2} ${x+size/2},0 ${x},${size/2} ${x-size/2},0`;
      g.appendChild(svgEl('polygon', { points: p, fill, stroke }));
    } else if (glyph.shape === 'triangle'){
      const p = `${x},${-size/2} ${x+size/2},${size/2} ${x-size/2},${size/2}`;
      g.appendChild(svgEl('polygon', { points: p, fill, stroke }));
    } else if (glyph.shape === 'plus'){
      const w = size/5;
      g.appendChild(svgEl('rect', { x: x-w/2, y: -size/2, width: w, height: size, fill, stroke:'none' }));
      g.appendChild(svgEl('rect', { x: x-size/2, y: -w/2, width: size, height: w, fill, stroke:'none' }));
    }
  }
}

function renderSpatial(item){
  const wrap = document.createElement('div');

  const svg = svgEl('svg', { width: '100%', viewBox: '0 0 360 120', role: 'img', 'aria-label': 'Rotation puzzle target' });
  svg.style.display = 'block';

  const rect = svgEl('rect', { x: 10, y: 10, width: 340, height: 100, rx: 14, fill: 'rgba(255,255,255,0.02)', stroke:'rgba(34,48,83,1)'});
  svg.appendChild(rect);

  drawPoly(svg, 180, 60, item.target);

  const t = svgEl('text', { x: 180, y: 115, 'text-anchor':'middle', 'font-size':'11', fill:'rgba(169,182,214,1)'});
  t.textContent = 'Target shape';
  svg.appendChild(t);

  wrap.appendChild(svg);

  // Options grid
  const opt = document.createElement('div');
  opt.style.display = 'grid';
  opt.style.gridTemplateColumns = 'repeat(4, 1fr)';
  opt.style.gap = '10px';
  opt.style.marginTop = '12px';

  const labels = ['A','B','C','D'];
  (item.options || []).slice(0,4).forEach((poly, i) => {
    const card = document.createElement('div');
    card.className = 'panel';
    card.style.padding = '10px';

    const s = svgEl('svg', { width:'100%', viewBox:'0 0 120 90', role:'img', 'aria-label': `Option ${labels[i]}` });
    s.style.display = 'block';

    const r = svgEl('rect', { x: 6, y: 6, width: 108, height: 70, rx: 12, fill:'rgba(255,255,255,0.02)', stroke:'rgba(34,48,83,1)'});
    s.appendChild(r);

    drawPoly(s, 60, 41, poly);

    const lab = svgEl('text', { x: 60, y: 86, 'text-anchor':'middle', 'font-size':'12', fill:'rgba(169,182,214,1)'});
    lab.textContent = labels[i];
    s.appendChild(lab);

    card.appendChild(s);
    opt.appendChild(card);
  });

  wrap.appendChild(opt);

  const note = document.createElement('div');
  note.className = 'muted';
  note.style.marginTop = '10px';
  note.innerHTML = 'Select <strong>A–D</strong> to choose an option. (Mirrors are not considered the same.)';
  wrap.appendChild(note);

  return wrap;
}

function drawPoly(svg, cx, cy, poly){
  const g = svgEl('g', { transform:`translate(${cx},${cy}) rotate(${poly.rot||0})` });
  svg.appendChild(g);

  const pts = poly.points.map(p => `${p[0]},${p[1]}`).join(' ');
  const fill = poly.fill || 'rgba(234,240,255,0.70)';
  const stroke = poly.stroke || 'rgba(234,240,255,0.25)';
  const shape = svgEl('polygon', { points: pts, fill, stroke, 'stroke-width': 2 });
  g.appendChild(shape);

  if (poly.hole){
    const pts2 = poly.hole.map(p => `${p[0]},${p[1]}`).join(' ');
    const hole = svgEl('polygon', { points: pts2, fill: 'rgba(0,0,0,0.28)', stroke:'rgba(234,240,255,0.15)', 'stroke-width': 1 });
    g.appendChild(hole);
  }
}

function renderSymbolSearch(node, page, session){
  // page: { type, keySymbols: [...], rows: [{targets:[...], choices:[...], answer:boolean}] }
  const wrap = document.createElement('div');
  wrap.style.display = 'grid';
  wrap.style.gap = '12px';

  const key = document.createElement('div');
  key.className = 'resultRow';
  key.innerHTML = `<div class="k">Key</div><div class="v">${page.keySymbols.join('  ')}</div>`;
  wrap.appendChild(key);

  const table = document.createElement('div');
  table.style.display = 'grid';
  table.style.gap = '8px';

  page.rows.forEach((row, i) => {
    const line = document.createElement('div');
    line.className = 'resultRow';
    line.style.alignItems = 'center';

    const left = document.createElement('div');
    left.className = 'k';
    left.textContent = row.pair.join('  ');

    const right = document.createElement('div');
    right.className = 'v';

    const yes = document.createElement('button');
    yes.className = 'btn';
    yes.textContent = 'Yes';
    yes.style.padding = '6px 10px';

    const no = document.createElement('button');
    no.className = 'btn';
    no.textContent = 'No';
    no.style.padding = '6px 10px';

    const mark = document.createElement('span');
    mark.style.marginLeft = '10px';
    mark.style.color = 'rgba(169,182,214,0.9)';
    mark.textContent = '';

    const answer = (val) => {
      // only first click counts
      if (row._done) return;
      row._done = true;

      const correct = (val === row.answer);
      mark.textContent = correct ? '✓' : '×';
      mark.style.color = correct ? 'rgba(46,204,113,1)' : 'rgba(231,76,60,1)';

      session.speedState.totalAttempted += 1;
      if (correct) session.speedState.totalCorrect += 1;
    };

    yes.addEventListener('click', () => answer(true));
    no.addEventListener('click', () => answer(false));

    right.appendChild(yes);
    right.appendChild(no);
    right.appendChild(mark);

    line.appendChild(left);
    line.appendChild(right);

    table.appendChild(line);
  });

  wrap.appendChild(table);

  session.lastMeta = {
    attempted: session.speedState.totalAttempted,
    correct: session.speedState.totalCorrect
  };

  return wrap;
}

function renderCoding(node, page, session){
  // page: { key: [{sym,digit}], prompts:[sym...], answers:[digit...] }
  const wrap = document.createElement('div');
  wrap.style.display = 'grid';
  wrap.style.gap = '12px';

  const key = document.createElement('div');
  key.className = 'panel';

  const keyGrid = document.createElement('div');
  keyGrid.style.display = 'grid';
  keyGrid.style.gridTemplateColumns = 'repeat(6, 1fr)';
  keyGrid.style.gap = '8px';

  page.key.forEach(k => {
    const cell = document.createElement('div');
    cell.className = 'resultRow';
    cell.style.padding = '8px 10px';
    cell.innerHTML = `<div class="k">${k.sym}</div><div class="v">${k.digit}</div>`;
    keyGrid.appendChild(cell);
  });

  key.appendChild(keyGrid);
  wrap.appendChild(key);

  const prompts = document.createElement('div');
  prompts.className = 'panel';

  const grid = document.createElement('div');
  grid.style.display = 'grid';
  grid.style.gridTemplateColumns = 'repeat(8, 1fr)';
  grid.style.gap = '8px';

  page.prompts.forEach((sym, i) => {
    const cell = document.createElement('div');
    cell.className = 'panel';
    cell.style.padding = '10px';

    const symEl = document.createElement('div');
    symEl.style.fontSize = '20px';
    symEl.style.fontWeight = '800';
    symEl.style.textAlign = 'center';
    symEl.textContent = sym;

    const input = document.createElement('input');
    input.className = 'textInput';
    input.style.marginTop = '8px';
    input.style.padding = '8px 10px';
    input.style.textAlign = 'center';
    input.maxLength = 1;
    input.inputMode = 'numeric';

    input.addEventListener('input', () => {
      const v = String(input.value || '').trim();
      if (!v) return;
      if (!/^[0-9]$/.test(v)){ input.value = ''; return; }
      // move focus to next
      const next = grid.querySelectorAll('input')[i+1];
      if (next) next.focus();
    });

    cell.appendChild(symEl);
    cell.appendChild(input);
    grid.appendChild(cell);
  });

  prompts.appendChild(grid);
  wrap.appendChild(prompts);

  // compute score when leaving page
  page._score = () => {
    const inputs = Array.from(grid.querySelectorAll('input'));
    let att = 0, cor = 0;
    inputs.forEach((inp, i) => {
      const v = String(inp.value || '').trim();
      if (!v) return;
      att += 1;
      if (v === String(page.answers[i])) cor += 1;
    });

    session.speedState.totalAttempted += att;
    session.speedState.totalCorrect += cor;

    session.lastMeta = { pageAttempted: att, pageCorrect: cor, totalAttempted: session.speedState.totalAttempted, totalCorrect: session.speedState.totalCorrect };
  };

  // hook into session by storing callback
  session.lastMeta = { note: 'coding page rendered' };
  session._codingScoreFn = page._score;

  return wrap;
}
