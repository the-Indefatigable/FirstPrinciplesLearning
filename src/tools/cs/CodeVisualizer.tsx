import React, { useRef, useState, useEffect, useCallback } from 'react';

/* ═══════════════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════════════ */
type VKind = 'number' | 'string' | 'boolean' | 'null' | 'undefined' | 'function' | 'array' | 'object';
interface VNode {
  kind: VKind;
  prim?: string | number | boolean;
  id?: number; items?: VNode[]; fields?: [string, VNode][]; len?: number;
}
interface Step { line: number; text: string; vars: [string, VNode][]; }

type Lang = 'js' | 'python' | 'java' | 'go';

/* ═══════════════════════════════════════════════════════════════════════
   SERIALISATION
   ═══════════════════════════════════════════════════════════════════════ */
function makeVNode(val: unknown, hm: WeakMap<object, number>, hc: { n: number }, depth: number): VNode {
  if (val === null)       return { kind: 'null' };
  if (val === undefined)  return { kind: 'undefined' };
  if (typeof val === 'function') return { kind: 'function' };
  if (typeof val === 'number')   return { kind: 'number',  prim: val };
  if (typeof val === 'string')   return { kind: 'string',  prim: val };
  if (typeof val === 'boolean')  return { kind: 'boolean', prim: val };
  if (!hm.has(val as object)) hm.set(val as object, hc.n++);
  const id = hm.get(val as object)!;
  if (Array.isArray(val)) {
    const items = depth < 2 ? (val as unknown[]).slice(0, 24).map(v => makeVNode(v, hm, hc, depth + 1)) : [];
    return { kind: 'array', id, items, len: (val as unknown[]).length };
  }
  const entries = Object.entries(val as object).slice(0, 16);
  const fields: [string, VNode][] = depth < 2
    ? entries.map(([k, v]) => [k, makeVNode(v, hm, hc, depth + 1)]) : [];
  return { kind: 'object', id, fields, len: entries.length };
}

/* ═══════════════════════════════════════════════════════════════════════
   JS INSTRUMENTATION
   ═══════════════════════════════════════════════════════════════════════ */
function extractVarNames(code: string): string[] {
  const names = new Set<string>();
  const re = /\b(?:let|const|var)\s+([a-zA-Z_$]\w*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(code))) names.add(m[1]);
  return [...names];
}

function instrumentJS(code: string, varNames: string[]): string {
  const cap = varNames.map(n => `"${n}":__g(function(){return ${n}})`).join(',');
  const mkStep = (ln: number, text: string) =>
    `  __step__(${ln},{${cap}},${JSON.stringify(text.slice(0, 80))});`;
  const lines = code.split('\n');
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i], tr = raw.trim();
    out.push(raw);
    if (!tr || tr.startsWith('//') || tr.startsWith('/*') || tr === '{' || tr === '}') continue;
    if (/^else\b/.test(tr)) continue;
    if (/^(?:for|while|if)\s*\(/.test(tr) && tr.endsWith('{')) continue;
    if (/^function\s+\w+/.test(tr)) continue;
    out.push(mkStep(i + 1, tr));
  }
  return out.join('\n');
}

/* ═══════════════════════════════════════════════════════════════════════
   PYTHON → JS TRANSPILER
   Returns { js, lineMap } where lineMap[jsLine] = pythonLine (1-indexed)
   ═══════════════════════════════════════════════════════════════════════ */
function transpilePython(py: string): { js: string; lineMap: number[] } {
  const pyLines = py.split('\n');
  const jsLines: string[] = [];
  // lineMap[i] = python line number that produced jsLines[i] (1-indexed, 0 = synthetic)
  const lineMap: number[] = [];
  const declared = new Set<string>();
  const indentStack: number[] = [0];

  const push = (s: string, pyLine: number) => { jsLines.push(s); lineMap.push(pyLine); };

  const convExpr = (s: string) =>
    s.replace(/\bNone\b/g, 'null')
     .replace(/\bTrue\b/g, 'true')
     .replace(/\bFalse\b/g, 'false')
     .replace(/\blen\s*\((\w+)\)/g, '$1.length')
     .replace(/\band\b/g, '&&')
     .replace(/\bor\b/g, '||')
     .replace(/\bnot\s+/g, '!')
     .replace(/\.append\s*\(/g, '.push(');

  for (let pi = 0; pi < pyLines.length; pi++) {
    const raw = pyLines[pi];
    const trimmed = raw.trimEnd();
    const content = raw.trimStart();
    const pyLineNum = pi + 1;

    if (!trimmed) { push('', 0); continue; }
    if (content.startsWith('#')) { push(`// ${content.slice(1).trim()}`, pyLineNum); continue; }

    const indent = raw.length - content.length;

    // Close blocks on dedent
    while (indentStack.length > 1 && indent < indentStack[indentStack.length - 1]) {
      indentStack.pop();
      push('  '.repeat(indentStack.length) + '}', 0);
    }

    const pad = '  '.repeat(indentStack.length);
    const endsColon = content.trimEnd().endsWith(':');

    // for i in range(n) / range(a, b)
    let m = content.match(/^for\s+(\w+)\s+in\s+range\s*\((.+)\)\s*:$/);
    if (m) {
      const [, v, args] = m;
      const parts = args.split(',').map(s => s.trim());
      const [start, end] = parts.length === 1 ? ['0', parts[0]] : [parts[0], parts[1]];
      if (!declared.has(v)) declared.add(v);
      push(`${pad}for (let ${v} = ${convExpr(start)}; ${v} < ${convExpr(end)}; ${v}++) {`, pyLineNum);
      indentStack.push(indent + 1);
      continue;
    }

    // for item in iterable
    m = content.match(/^for\s+(\w+)\s+in\s+(.+)\s*:$/);
    if (m) {
      const [, v, iter] = m;
      if (!declared.has(v)) declared.add(v);
      push(`${pad}for (let ${v} of ${convExpr(iter)}) {`, pyLineNum);
      indentStack.push(indent + 1);
      continue;
    }

    // while
    m = content.match(/^while\s+(.+)\s*:$/);
    if (m) {
      push(`${pad}while (${convExpr(m[1])}) {`, pyLineNum);
      indentStack.push(indent + 1);
      continue;
    }

    // if / elif / else
    m = content.match(/^if\s+(.+)\s*:$/);
    if (m) { push(`${pad}if (${convExpr(m[1])}) {`, pyLineNum); indentStack.push(indent + 1); continue; }
    m = content.match(/^elif\s+(.+)\s*:$/);
    if (m) {
      // close current if-block then open else-if
      if (indentStack.length > 1) indentStack.pop();
      push(`${'  '.repeat(indentStack.length)}} else if (${convExpr(m[1])}) {`, pyLineNum);
      indentStack.push(indent + 1);
      continue;
    }
    if (content.trim() === 'else:') {
      if (indentStack.length > 1) indentStack.pop();
      push(`${'  '.repeat(indentStack.length)}} else {`, pyLineNum);
      indentStack.push(indent + 1);
      continue;
    }

    // print → skip (just emit a comment so it counts as a step)
    m = content.match(/^print\s*\((.+)\)\s*;?$/);
    if (m) { push(`${pad}// print(${m[1]})`, pyLineNum); continue; }

    // Augmented assignment: x += 1
    m = content.match(/^([a-zA-Z_]\w*)\s*([+\-*\/]=)\s*(.+?)\s*;?$/);
    if (m) {
      const [, name, op, val] = m;
      push(`${pad}${name} ${op} ${convExpr(val)};`, pyLineNum);
      continue;
    }

    // Simple assignment: x = expr
    m = content.match(/^([a-zA-Z_]\w*)\s*=\s*(.+?)\s*;?$/);
    if (m && !content.includes('==') && !endsColon) {
      const [, name, val] = m;
      const decl = !declared.has(name);
      if (decl) declared.add(name);
      push(`${pad}${decl ? 'let ' : ''}${name} = ${convExpr(val)};`, pyLineNum);
      continue;
    }

    // Dict/attr assignment: obj["key"] = val  OR  obj.key = val
    m = content.match(/^(\w+(?:\[.+?\]|(?:\.\w+)+))\s*=\s*(.+?)\s*;?$/);
    if (m && !content.includes('==')) {
      push(`${pad}${convExpr(m[1])} = ${convExpr(m[2])};`, pyLineNum);
      continue;
    }

    // Everything else
    let line = convExpr(content.replace(/#.*$/, s => `// ${s.slice(1).trim()}`));
    if (!line.endsWith('{') && !line.endsWith('}') && !line.endsWith(';')) line += ';';
    push(`${pad}${line}`, pyLineNum);
  }

  // Close remaining open blocks
  while (indentStack.length > 1) {
    indentStack.pop();
    push('  '.repeat(indentStack.length) + '}', 0);
  }

  return { js: jsLines.join('\n'), lineMap };
}

/* ═══════════════════════════════════════════════════════════════════════
   RUNNER
   ═══════════════════════════════════════════════════════════════════════ */
interface RunResult { steps: Step[]; error?: string; }

function runCode(jsCode: string): RunResult {
  const varNames = extractVarNames(jsCode);
  const instrumented = instrumentJS(jsCode, varNames);
  const steps: Step[] = [];
  const hm = new WeakMap<object, number>();
  const hc = { n: 1 };
  const startMs = Date.now();

  const __step__ = (lineNum: number, rawVars: Record<string, unknown>, text: string) => {
    if (Date.now() - startMs > 2500) throw new Error('Execution timed out (2.5 s). Check for infinite loops.');
    if (steps.length >= 250) throw new Error('Too many steps (max 250).');
    const vars: [string, VNode][] = Object.entries(rawVars)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => [k, makeVNode(v, hm, hc, 0)]);
    steps.push({ line: lineNum, text, vars });
  };

  try {
    const pre = `"use strict";function __g(fn){try{return fn();}catch(_){return undefined;}}\n`;
    // eslint-disable-next-line no-new-func
    new Function('__step__', pre + instrumented)(__step__);
  } catch (e: unknown) {
    return { steps, error: (e as Error).message };
  }
  return { steps };
}

/* ═══════════════════════════════════════════════════════════════════════
   CANVAS — palette, drawing helpers, drawStep, drawLoading
   ═══════════════════════════════════════════════════════════════════════ */
interface Pal {
  bg: string; grid: string; border: string; txt: string; dim: string;
  headerBg: string; headerAccent: string;
  numBg: string; numFg: string; strBg: string; strFg: string;
  boolBg: string; boolFg: string; nullFg: string;
  arrBg: string; arrBorder: string; arrIdx: string;
  objBg: string; objKey: string; labelFg: string; secLine: string;
}
function pal(dark: boolean): Pal {
  return dark ? {
    bg:'#16130f',grid:'#1e1a15',border:'#332c24',txt:'#e8e4de',dim:'#6b6358',
    headerBg:'#1e1a14',headerAccent:'#f59e0b',
    numBg:'#0e2218',numFg:'#6ee7b7',strBg:'#0a1e2d',strFg:'#7dd3fc',
    boolBg:'#1c0e2d',boolFg:'#c4b5fd',nullFg:'#6b6358',
    arrBg:'#0e1e0e',arrBorder:'#2a442a',arrIdx:'#4a7a4a',
    objBg:'#0e0e1e',objKey:'#94a3b8',labelFg:'#9c9488',secLine:'#2a2420',
  } : {
    bg:'#faf8f5',grid:'#ede7da',border:'#d6c9b0',txt:'#1a1612',dim:'#9c9488',
    headerBg:'#fef3c7',headerAccent:'#b45309',
    numBg:'#dcfce7',numFg:'#15803d',strBg:'#dbeafe',strFg:'#1d4ed8',
    boolBg:'#f3e8ff',boolFg:'#7c3aed',nullFg:'#9c9488',
    arrBg:'#f0fdf4',arrBorder:'#bbf7d0',arrIdx:'#22c55e',
    objBg:'#eff6ff',objKey:'#475569',labelFg:'#78716c',secLine:'#e8e0d0',
  };
}
function vLabel(n: VNode, max = 20): string {
  switch (n.kind) {
    case 'number':    return String(n.prim);
    case 'string':    return `"${String(n.prim).slice(0, max)}"`;
    case 'boolean':   return String(n.prim);
    case 'null':      return 'null';
    case 'undefined': return 'undefined';
    case 'function':  return 'ƒ()';
    case 'array':     return `Array(${n.len ?? n.items?.length ?? 0})`;
    case 'object':    return `{${(n.fields ?? []).map(([k]) => k).join(', ').slice(0, 24)}}`;
  }
}
function isPrim(n: VNode) { return ['number','string','boolean','null','undefined','function'].includes(n.kind); }
function primFg(n: VNode, P: Pal) {
  switch (n.kind) {
    case 'number': return P.numFg; case 'string': return P.strFg;
    case 'boolean': return P.boolFg; default: return P.nullFg;
  }
}
function primBg(n: VNode, P: Pal) {
  switch (n.kind) {
    case 'number': return P.numBg; case 'string': return P.strBg;
    case 'boolean': return P.boolBg; default: return 'transparent';
  }
}
const MONO = '"JetBrains Mono","Fira Mono","Courier New",monospace';
const SANS = 'Sora,system-ui,sans-serif';

function drawVarRow(
  ctx: CanvasRenderingContext2D, P: Pal,
  name: string, node: VNode, x: number, y: number, maxW: number,
): number {
  ctx.font = `bold 11px ${SANS}`; ctx.fillStyle = P.labelFg;
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  const nameW = ctx.measureText(name).width;
  ctx.fillText(name, x, y + 11);
  const vx = x + nameW + 10, vy = y;

  if (isPrim(node)) {
    const label = vLabel(node, 28);
    ctx.font = `13px ${MONO}`;
    const tw = Math.max(ctx.measureText(label).width + 18, 38), bh = 22;
    const bg = primBg(node, P);
    if (bg !== 'transparent') { ctx.fillStyle = bg; ctx.beginPath(); ctx.roundRect(vx, vy, tw, bh, 4); ctx.fill(); }
    ctx.strokeStyle = P.border; ctx.lineWidth = 1; ctx.beginPath(); ctx.roundRect(vx, vy, tw, bh, 4); ctx.stroke();
    ctx.fillStyle = primFg(node, P); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(label, vx + tw / 2, vy + 11);
    return 32;
  }

  if (node.kind === 'array') {
    if (!node.items || node.items.length === 0) {
      ctx.font = `12px ${MONO}`; ctx.fillStyle = P.dim;
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText('[ ]  (empty)', vx, vy + 11); return 32;
    }
    const CELL = 40, CH = 22;
    const vis = Math.min(node.items.length, Math.floor((maxW - nameW - 20) / CELL));
    for (let i = 0; i < vis; i++) {
      const item = node.items[i], cx = vx + i * CELL;
      ctx.fillStyle = P.arrBg; ctx.strokeStyle = P.arrBorder; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.rect(cx, vy, CELL, CH); ctx.fill(); ctx.stroke();
      ctx.font = `9px ${MONO}`; ctx.fillStyle = P.arrIdx; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.fillText(String(i), cx + CELL / 2, vy - 10);
      ctx.font = `11px ${MONO}`; ctx.fillStyle = primFg(item, P) !== P.nullFg ? primFg(item, P) : P.dim;
      ctx.textBaseline = 'middle'; ctx.fillText(vLabel(item, 4), cx + CELL / 2, vy + 11);
    }
    if ((node.len ?? node.items.length) > vis) {
      ctx.font = `11px ${SANS}`; ctx.fillStyle = P.dim; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(`+${(node.len ?? node.items.length) - vis}`, vx + vis * CELL + 6, vy + 11);
    }
    return 42;
  }

  if (node.kind === 'object') {
    if (!node.fields || node.fields.length === 0) {
      ctx.font = `12px ${MONO}`; ctx.fillStyle = P.dim;
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText('{ }  (empty)', vx, vy + 11); return 32;
    }
    const LH = 20, PAD = 10, cardH = node.fields.length * LH + PAD * 2;
    const cardW = Math.min(maxW - nameW - 20, 260);
    ctx.fillStyle = P.objBg; ctx.strokeStyle = P.border; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(vx, vy, cardW, cardH, 6); ctx.fill(); ctx.stroke();
    for (let fi = 0; fi < node.fields.length; fi++) {
      const [fk, fv] = node.fields[fi], fy = vy + PAD + fi * LH;
      ctx.font = `bold 10px ${SANS}`; ctx.fillStyle = P.objKey;
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(`${fk}:`, vx + PAD, fy + LH / 2);
      const kw = ctx.measureText(`${fk}: `).width + PAD + 4;
      ctx.font = `11px ${MONO}`;
      ctx.fillStyle = fv.kind === 'null' || fv.kind === 'undefined' ? P.nullFg : primFg(fv, P) !== P.nullFg ? primFg(fv, P) : P.txt;
      ctx.fillText(vLabel(fv, 22), vx + kw, fy + LH / 2);
    }
    return node.fields.length * 20 + 22;
  }

  ctx.font = `12px ${MONO}`; ctx.fillStyle = P.dim;
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText(vLabel(node), vx, vy + 11); return 32;
}

function drawStep(
  canvas: HTMLCanvasElement, box: HTMLDivElement,
  step: Step, idx: number, total: number, dark: boolean,
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const r = box.getBoundingClientRect();
  if (r.width === 0) return;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = r.width * dpr; canvas.height = r.height * dpr;
  ctx.scale(dpr, dpr); canvas.style.width = `${r.width}px`; canvas.style.height = `${r.height}px`;
  const W = r.width, H = r.height, P = pal(dark);

  ctx.fillStyle = P.bg; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = P.grid; ctx.lineWidth = 0.5;
  for (let gx = 0; gx < W; gx += 40) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke(); }
  for (let gy = 0; gy < H; gy += 40) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke(); }

  const HH = 40;
  ctx.fillStyle = P.headerBg; ctx.fillRect(0, 0, W, HH);
  ctx.strokeStyle = P.border; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, HH); ctx.lineTo(W, HH); ctx.stroke();
  ctx.font = `bold 12px ${SANS}`; ctx.fillStyle = P.headerAccent;
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText(`Step ${idx + 1} / ${total}`, 16, HH / 2);
  const bw = ctx.measureText(`Step ${idx + 1} / ${total}`).width;
  ctx.font = `11px ${MONO}`; ctx.fillStyle = P.dim;
  ctx.fillText(`  ·  line ${step.line}: ${step.text.slice(0, 68)}`, 16 + bw, HH / 2);

  const PAD = 20; let curY = HH + 16;
  if (step.vars.length === 0) {
    ctx.font = `13px ${SANS}`; ctx.fillStyle = P.dim;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('No variables declared yet.', W / 2, H / 2); return;
  }
  ctx.font = `bold 10px ${SANS}`; ctx.fillStyle = P.dim;
  ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.fillText('MEMORY STATE', PAD, curY); curY += 16;
  ctx.strokeStyle = P.secLine; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(PAD, curY); ctx.lineTo(W - PAD, curY); ctx.stroke(); curY += 12;
  for (const [name, node] of step.vars) {
    if (curY > H - 30) break;
    curY += drawVarRow(ctx, P, name, node, PAD, curY, W - PAD * 2);
  }
}

function drawLoading(canvas: HTMLCanvasElement, box: HTMLDivElement, t: number, dark: boolean) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const r = box.getBoundingClientRect();
  if (r.width === 0) return;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = r.width * dpr; canvas.height = r.height * dpr;
  ctx.scale(dpr, dpr); canvas.style.width = `${r.width}px`; canvas.style.height = `${r.height}px`;
  const W = r.width, H = r.height, P = pal(dark);
  ctx.fillStyle = P.bg; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = P.grid; ctx.lineWidth = 0.5;
  for (let gx = 0; gx < W; gx += 40) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke(); }
  for (let gy = 0; gy < H; gy += 40) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke(); }
  const cx = W / 2, cy = H / 2, N = 10, R = 26, dotR = 4.5;
  const phase = (t / 80) % N;
  for (let i = 0; i < N; i++) {
    const angle = (i / N) * Math.PI * 2 - Math.PI / 2;
    const dist = ((phase - i + N) % N) / N;
    ctx.fillStyle = dark ? `rgba(245,158,11,${0.15 + 0.85 * (1 - dist)})` : `rgba(180,83,9,${0.15 + 0.85 * (1 - dist)})`;
    ctx.beginPath(); ctx.arc(cx + Math.cos(angle) * R, cy + Math.sin(angle) * R, dotR, 0, Math.PI * 2); ctx.fill();
  }
  ctx.font = `bold 14px ${SANS}`; ctx.fillStyle = dark ? '#e8e4de' : '#1a1612';
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.fillText('Tracing…', cx, cy + R + 14);
  ctx.font = `11px ${SANS}`; ctx.fillStyle = P.dim;
  ctx.fillText('running your code', cx, cy + R + 32);
}

/* ═══════════════════════════════════════════════════════════════════════
   CODE AREA — textarea with line numbers + current-line highlight
   ═══════════════════════════════════════════════════════════════════════ */
const LH = 21;   // exact line height in px — must match textarea lineHeight
const PT = 10;   // padding-top in px
const LNW = 44;  // gutter width in px

interface CodeAreaProps {
  code: string; setCode: (c: string) => void;
  activeLine: number; dark: boolean; lang: Lang;
}

function CodeArea({ code, setCode, activeLine, dark, lang }: CodeAreaProps) {
  const taRef  = useRef<HTMLTextAreaElement>(null);
  const bgRef  = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const lines = code.split('\n');

  const bgColor  = dark ? '#0d0b08' : '#f8f8f2';
  const gutterBg = dark ? '#0a0806' : '#f0ede8';
  const gutterBorder = dark ? '#1e1a16' : '#e0d8cc';

  return (
    <div style={{
      position: 'relative', height: 190,
      border: '1px solid var(--border-warm)',
      borderRadius: 'var(--radius-sm)',
      overflow: 'hidden', marginBottom: 10,
      background: bgColor,
    }}>
      {/* Background layer: line numbers + row highlights, scrolls via translateY */}
      <div ref={bgRef} style={{
        position: 'absolute', inset: 0,
        overflow: 'hidden', pointerEvents: 'none', zIndex: 0,
      }}>
        <div style={{ transform: `translateY(${PT - scrollTop}px)` }}>
          {lines.map((_, i) => {
            const active = i + 1 === activeLine;
            return (
              <div key={i} style={{
                display: 'flex', height: LH, alignItems: 'stretch',
              }}>
                {/* Gutter */}
                <div style={{
                  width: LNW, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: MONO, fontSize: 11,
                  color: active ? '#f59e0b' : dark ? '#3a3530' : '#b8b0a0',
                  fontWeight: active ? 'bold' : 'normal',
                  background: active
                    ? (dark ? 'rgba(245,158,11,0.14)' : 'rgba(245,158,11,0.1)')
                    : gutterBg,
                  borderRight: `1px solid ${gutterBorder}`,
                  userSelect: 'none',
                }}>
                  {active ? '▶' : i + 1}
                </div>
                {/* Code row highlight */}
                <div style={{
                  flex: 1,
                  background: active
                    ? (dark ? 'rgba(245,158,11,0.07)' : 'rgba(245,158,11,0.08)')
                    : 'transparent',
                  borderLeft: active ? '2px solid #f59e0b' : '2px solid transparent',
                }} />
              </div>
            );
          })}
        </div>
      </div>

      {/* Textarea on top */}
      <textarea
        ref={taRef}
        value={code}
        onChange={e => setCode(e.target.value)}
        onScroll={e => setScrollTop((e.target as HTMLTextAreaElement).scrollTop)}
        spellCheck={false}
        placeholder={`Write ${lang === 'python' ? 'Python' : 'JavaScript'} here…`}
        style={{
          position: 'absolute', inset: 0,
          padding: `${PT}px 14px ${PT}px ${LNW + 10}px`,
          fontFamily: MONO, fontSize: '13px', lineHeight: `${LH}px`,
          background: 'transparent',
          color: dark ? '#e8e4de' : '#1a1612',
          border: 'none', outline: 'none', resize: 'none',
          width: '100%', height: '100%', boxSizing: 'border-box',
          caretColor: '#f59e0b', zIndex: 1,
        }}
      />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   DEFAULT EXAMPLES
   ═══════════════════════════════════════════════════════════════════════ */
const EXAMPLES: Record<Lang, string> = {
  js: `// Linked list — watch references form
let c = { val: 3, next: null };
let b = { val: 2, next: c };
let a = { val: 1, next: b };

let cur = a;
let sum = 0;
while (cur !== null) {
  sum += cur.val;
  cur = cur.next;
}`,

  python: `# Find max in a list
nums = [4, 2, 9, 1, 7]
max_val = nums[0]
i = 1
while i < len(nums):
    if nums[i] > max_val:
        max_val = nums[i]
    i += 1`,

  java: '',
  go: '',
};

const LANG_META: Record<Lang, { label: string; color: string; bg: string }> = {
  js:     { label: 'JavaScript', color: '#b45309', bg: 'rgba(245,158,11,0.12)' },
  python: { label: 'Python',     color: '#1d4ed8', bg: 'rgba(59,130,246,0.12)' },
  java:   { label: 'Java',       color: '#b91c1c', bg: 'rgba(239,68,68,0.12)'  },
  go:     { label: 'Go',         color: '#0369a1', bg: 'rgba(14,165,233,0.12)' },
};

/* ═══════════════════════════════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════════════════════════════ */
export default function CodeVisualizer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boxRef    = useRef<HTMLDivElement>(null);
  const animRef   = useRef<number | null>(null);

  const [lang,    setLang]    = useState<Lang>('js');
  const [code,    setCode]    = useState(EXAMPLES.js);
  const [steps,   setSteps]   = useState<Step[]>([]);
  const [stepIdx, setStepIdx] = useState(0);
  const [status,  setStatus]  = useState<'idle' | 'processing' | 'ready' | 'error'>('idle');
  const [error,   setError]   = useState<string | null>(null);
  const [dark,    setDark]    = useState(
    () => document.documentElement.getAttribute('data-theme') === 'dark'
  );
  // lineMap: for Python, maps JS line → Python source line
  const lineMapRef = useRef<number[]>([]);

  useEffect(() => {
    const obs = new MutationObserver(() =>
      setDark(document.documentElement.getAttribute('data-theme') === 'dark')
    );
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);

  const startLoading = useCallback(() => {
    if (animRef.current) cancelAnimationFrame(animRef.current);
    let t = 0;
    const loop = () => {
      const cvs = canvasRef.current, box = boxRef.current;
      if (cvs && box) drawLoading(cvs, box, t, dark);
      t += 16; animRef.current = requestAnimationFrame(loop);
    };
    animRef.current = requestAnimationFrame(loop);
  }, [dark]);

  const stopLoading = useCallback(() => {
    if (animRef.current) { cancelAnimationFrame(animRef.current); animRef.current = null; }
  }, []);

  // Process code with debounce
  useEffect(() => {
    if (lang === 'java' || lang === 'go') { setStatus('idle'); return; }
    if (!code.trim()) { setStatus('idle'); return; }
    setStatus('processing');
    startLoading();

    const timer = setTimeout(() => {
      let jsCode = code;
      lineMapRef.current = [];

      if (lang === 'python') {
        const { js, lineMap } = transpilePython(code);
        jsCode = js;
        lineMapRef.current = lineMap;
      }

      const result = runCode(jsCode);
      stopLoading();

      if (result.error) {
        setError(result.error);
        setStatus('error');
      } else if (result.steps.length === 0) {
        setError('No steps captured — make sure your code uses variable assignments.');
        setStatus('error');
      } else {
        setSteps(result.steps);
        setStepIdx(0);
        setError(null);
        setStatus('ready');
      }
    }, 600);

    return () => { clearTimeout(timer); stopLoading(); };
  }, [code, lang]); // eslint-disable-line react-hooks/exhaustive-deps

  // Draw current step
  useEffect(() => {
    if (status !== 'ready' || steps.length === 0) return;
    const cvs = canvasRef.current, box = boxRef.current;
    if (!cvs || !box) return;
    drawStep(cvs, box, steps[stepIdx], stepIdx, steps.length, dark);
  }, [status, stepIdx, steps, dark]);

  // Resize redraw
  useEffect(() => {
    const obs = new ResizeObserver(() => {
      if (status === 'ready' && steps.length > 0) {
        const cvs = canvasRef.current, box = boxRef.current;
        if (cvs && box) drawStep(cvs, box, steps[stepIdx], stepIdx, steps.length, dark);
      }
    });
    if (boxRef.current) obs.observe(boxRef.current);
    return () => obs.disconnect();
  }, [status, stepIdx, steps, dark]);

  // Keyboard nav
  useEffect(() => {
    if (status !== 'ready') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') setStepIdx(i => Math.min(i + 1, steps.length - 1));
      if (e.key === 'ArrowLeft')  setStepIdx(i => Math.max(i - 1, 0));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [status, steps.length]);

  const switchLang = (l: Lang) => {
    setLang(l);
    setCode(EXAMPLES[l] || '');
    setSteps([]); setStepIdx(0); setStatus('idle'); setError(null);
  };

  // Compute which source line to highlight
  const cur = steps[stepIdx];
  const jsLine = cur?.line ?? 0;
  const activeLine = lang === 'python' && lineMapRef.current.length > 0
    ? (lineMapRef.current[jsLine - 1] ?? 0)
    : jsLine;

  const atFirst = stepIdx === 0, atLast = stepIdx === steps.length - 1;
  const lm = LANG_META[lang];
  const unsupported = lang === 'java' || lang === 'go';

  return (
    <div className="tool-card">
      <div className="tool-card-header">
        <h3>Code Visualizer</h3>
        <span className="subject-topic" style={{ background: lm.bg, color: lm.color, border: `1px solid ${lm.color}33` }}>
          {lm.label}
        </span>
      </div>

      <div className="tool-card-body">
        {/* Language selector */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
          {(['js', 'python', 'java', 'go'] as Lang[]).map(l => {
            const m = LANG_META[l];
            const active = l === lang;
            return (
              <button
                key={l}
                onClick={() => switchLang(l)}
                style={{
                  padding: '4px 12px', borderRadius: 20, fontSize: '0.78rem', fontWeight: 600,
                  border: `1px solid ${active ? m.color : 'var(--border-warm)'}`,
                  background: active ? m.bg : 'transparent',
                  color: active ? m.color : 'var(--text-dim)',
                  cursor: 'pointer', transition: 'all 0.15s',
                }}
              >
                {m.label}
              </button>
            );
          })}
        </div>

        {/* Unsupported language notice */}
        {unsupported ? (
          <div style={{
            padding: '16px 20px', borderRadius: 'var(--radius-sm)',
            background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)',
            marginBottom: 10,
          }}>
            <div style={{ fontWeight: 700, marginBottom: 4, color: 'var(--text-primary)' }}>
              {lm.label} — coming soon
            </div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-dim)' }}>
              {lm.label} requires a compiler/runtime that can't run directly in the browser.
              Full support is on the roadmap. For now, try <strong>JavaScript</strong> or <strong>Python</strong> — both run natively here.
            </div>
          </div>
        ) : (
          <>
            {/* Code editor with line highlighting */}
            <CodeArea
              code={code} setCode={setCode}
              activeLine={status === 'ready' ? activeLine : 0}
              dark={dark} lang={lang}
            />

            {/* Canvas */}
            <div ref={boxRef} style={{
              width: '100%', aspectRatio: '16/9',
              background: dark ? '#16130f' : '#faf8f5',
              border: '1px solid var(--border-warm)',
              borderRadius: 'var(--radius-md)',
              overflow: 'hidden', marginBottom: 10,
            }}>
              <canvas ref={canvasRef} style={{ display: 'block' }} />
            </div>

            {/* Navigation */}
            {status === 'ready' && steps.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button
                  className="tool-btn tool-btn--outline"
                  onClick={() => setStepIdx(i => Math.max(i - 1, 0))}
                  disabled={atFirst} style={{ opacity: atFirst ? 0.35 : 1, minWidth: 90 }}
                >← Back</button>

                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ height: 4, borderRadius: 2, background: 'var(--border-warm)', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', background: lm.color, borderRadius: 2,
                      width: `${((stepIdx + 1) / steps.length) * 100}%`,
                      transition: 'width 0.15s ease',
                    }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                    <span>
                      <strong style={{ color: 'var(--text-primary)' }}>Step {stepIdx + 1}</strong>
                      {' '}of {steps.length}
                      {cur && <span style={{ marginLeft: 8, fontFamily: 'monospace', fontSize: '0.72rem' }}>
                        · source line {activeLine}
                      </span>}
                    </span>
                    <span style={{ fontFamily: 'monospace', fontSize: '0.72rem' }}>← → keys work too</span>
                  </div>
                </div>

                <button
                  className="tool-btn tool-btn--outline"
                  onClick={() => setStepIdx(i => Math.min(i + 1, steps.length - 1))}
                  disabled={atLast} style={{ opacity: atLast ? 0.35 : 1, minWidth: 90 }}
                >Next →</button>
              </div>
            )}

            {status === 'error' && error && (
              <div style={{
                padding: '10px 14px', borderRadius: 'var(--radius-sm)',
                background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.25)',
                color: '#ef4444', fontSize: '0.8rem', fontFamily: 'monospace',
              }}>✗ {error}</div>
            )}

            {status === 'idle' && (
              <p style={{ fontSize: '0.78rem', color: 'var(--text-dim)', textAlign: 'center', margin: 0 }}>
                Type code above — visualization runs automatically.
              </p>
            )}
          </>
        )}

        {/* Footer */}
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          marginTop: 8, fontSize: '0.74rem', color: 'var(--text-dim)',
        }}>
          <span>primitives · arrays · objects · loops · linked lists · max 250 steps</span>
          <span>{lm.label} {unsupported ? '(soon)' : '✓'}</span>
        </div>
      </div>
    </div>
  );
}
