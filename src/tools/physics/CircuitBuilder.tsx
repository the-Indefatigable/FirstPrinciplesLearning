import { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import type { SchComponent, Wire, SimResults, Probe, Viewport, EditorMode, AnalysisMode, ComponentKind } from './circuit/types';
import { getPins, solveDC, solveTransient, detectNodes, formatVal } from './circuit/solver';
import ToolLayoutSplit from '../../components/tool/ToolLayoutSplit';

// ─── Constants ────────────────────────────────────────────────────────────────
const GRID = 20; // px per grid unit

// ─── Default circuit: Half-Wave Rectifier with Smoothing Cap ─────────────────
// AC source (12V, 60Hz) → D1 (diode) → Node A (output)
//   R1 (2.2kΩ load) and C1 (100µF smoothing) in parallel from Node A to GND.
// Probes on V-in and V-out show the rectification + smoothing effect clearly.
const DEFAULT_COMPS: SchComponent[] = [
  { id: 'v1', kind: 'acsource', gx: 5,  gy: 10, rotation: 0,  value: 12,    value2: 60,   label: 'V1',  selected: false },
  { id: 'd1', kind: 'diode',    gx: 13, gy: 8,  rotation: 0,  value: 0,     label: 'D1',  selected: false },
  { id: 'j1', kind: 'junction', gx: 18, gy: 8,  rotation: 0,  value: 0,     label: 'J',   selected: false },
  { id: 'j2', kind: 'junction', gx: 23, gy: 8,  rotation: 0,  value: 0,     label: 'J',   selected: false },
  { id: 'r1', kind: 'resistor', gx: 18, gy: 12, rotation: 90, value: 2200,  label: 'R1',  selected: false },
  { id: 'c1', kind: 'capacitor',gx: 23, gy: 12, rotation: 90, value: 100e-6,label: 'C1',  selected: false },
  { id: 'g1', kind: 'ground',   gx: 3,  gy: 14, rotation: 0,  value: 0,     label: 'GND', selected: false },
  { id: 'g2', kind: 'ground',   gx: 18, gy: 16, rotation: 0,  value: 0,     label: 'GND', selected: false },
  { id: 'g3', kind: 'ground',   gx: 23, gy: 16, rotation: 0,  value: 0,     label: 'GND', selected: false },
];
const DEFAULT_WIRES: Wire[] = [
  { id: 'w1', x1: 7,  y1: 10, x2: 7,  y2: 8  }, // V1+ up to diode row
  { id: 'w2', x1: 7,  y1: 8,  x2: 11, y2: 8  }, // V1+ → D1 anode
  { id: 'w3', x1: 15, y1: 8,  x2: 18, y2: 8  }, // D1 cathode → J1
  { id: 'w4', x1: 18, y1: 8,  x2: 23, y2: 8  }, // J1 → J2
  { id: 'w5', x1: 18, y1: 8,  x2: 18, y2: 10 }, // J1 → R1 top
  { id: 'w6', x1: 23, y1: 8,  x2: 23, y2: 10 }, // J2 → C1 top
  { id: 'w7', x1: 3,  y1: 10, x2: 3,  y2: 14 }, // V1− → GND1
  { id: 'w8', x1: 18, y1: 14, x2: 18, y2: 16 }, // R1 bottom → GND2
  { id: 'w9', x1: 23, y1: 14, x2: 23, y2: 16 }, // C1 bottom → GND3
];

// ─── Component palette definition ────────────────────────────────────────────
interface PalItem { kind: ComponentKind; label: string; key: string; defaultValue: number; defaultV2?: number; }
const PALETTE: { group: string; items: PalItem[] }[] = [
  {
    group: 'Passive',
    items: [
      { kind: 'resistor', label: 'Resistor', key: 'R', defaultValue: 1000 },
      { kind: 'capacitor', label: 'Capacitor', key: 'C', defaultValue: 100e-6 },
      { kind: 'inductor', label: 'Inductor', key: 'L', defaultValue: 10e-3 },
    ],
  },
  {
    group: 'Sources',
    items: [
      { kind: 'vsource', label: 'DC Voltage', key: 'V', defaultValue: 5 },
      { kind: 'isource', label: 'DC Current', key: 'I', defaultValue: 0.01 },
      { kind: 'acsource', label: 'AC Voltage', key: '~', defaultValue: 5, defaultV2: 1000 },
    ],
  },
  {
    group: 'Semiconductors',
    items: [
      { kind: 'diode', label: 'Diode', key: 'D', defaultValue: 0 },
      { kind: 'led', label: 'LED', key: 'LED', defaultValue: 0 },
      { kind: 'zener', label: 'Zener', key: 'Z', defaultValue: 5.1 },
      { kind: 'npn', label: 'NPN BJT', key: 'Q', defaultValue: 0 },
      { kind: 'nmos', label: 'N-MOSFET', key: 'M', defaultValue: 0 },
      { kind: 'opamp', label: 'Op-Amp', key: 'U', defaultValue: 0 },
    ],
  },
  {
    group: 'Misc',
    items: [
      { kind: 'ground', label: 'Ground', key: 'GND', defaultValue: 0 },
      { kind: 'vcc', label: 'VCC', key: 'VCC', defaultValue: 5 },
      { kind: 'switch', label: 'Switch', key: 'SW', defaultValue: 0 },
      { kind: 'junction', label: 'Junction', key: '•', defaultValue: 0 },
    ],
  },
];

const PROBE_COLORS = ['#f59e0b', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

function unitSuffix(kind: ComponentKind): string {
  switch (kind) {
    case 'resistor': return 'Ω';
    case 'capacitor': return 'F';
    case 'inductor': return 'H';
    case 'vsource': case 'acsource': case 'vcc': return 'V';
    case 'isource': return 'A';
    case 'zener': return 'V';
    default: return '';
  }
}

function labelPrefix(kind: ComponentKind): string {
  switch (kind) {
    case 'resistor': return 'R'; case 'capacitor': return 'C'; case 'inductor': return 'L';
    case 'vsource': return 'V'; case 'isource': return 'I'; case 'acsource': return 'V';
    case 'diode': return 'D'; case 'led': return 'LED'; case 'zener': return 'Z';
    case 'npn': return 'Q'; case 'pnp': return 'Q'; case 'nmos': return 'M'; case 'pmos': return 'M';
    case 'opamp': return 'U'; case 'switch': return 'SW'; case 'ground': return 'GND';
    case 'vcc': return 'VCC'; case 'junction': return 'J';
    default: return 'X';
  }
}

// voltage → heatmap color  0V=green, +V=red, -V=blue
function voltageColor(v: number, vmax: number): string {
  if (vmax < 0.001) return '#22c55e';
  const t = Math.max(-1, Math.min(1, v / vmax));
  if (t >= 0) {
    const r = Math.round(34 + (239 - 34) * t);
    const g = Math.round(197 - (197 - 68) * t);
    const b = Math.round(94 - 94 * t);
    return `rgb(${r},${g},${b})`;
  } else {
    const s = -t;
    const r = Math.round(34 + (59 - 34) * s);
    const g = Math.round(197 - (130 - 197) * s);
    const b = Math.round(94 + (246 - 94) * s);
    return `rgb(${r},${g},${b})`;
  }
}

// ─── Canvas drawing ──────────────────────────────────────────────────────────

function drawComponent(
  ctx: CanvasRenderingContext2D,
  c: SchComponent,
  isDark: boolean,
  simResults: SimResults | null,
) {
  const stroke = isDark ? '#e8e4de' : '#1a1612';
  const dimStroke = isDark ? '#6b6560' : '#9c9488';
  const amber = '#d97706';
  const green = '#10b981';
  const blue = '#3b82f6';
  const red = '#ef4444';
  const S = GRID; // one grid unit in world px

  ctx.save();
  ctx.translate(c.gx * S, c.gy * S);
  ctx.rotate((c.rotation * Math.PI) / 180);

  ctx.strokeStyle = c.selected ? amber : stroke;
  ctx.lineWidth = c.selected ? 2.5 : 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const W = 2 * S; // half-width of component body

  switch (c.kind) {
    case 'resistor': {
      ctx.beginPath(); ctx.moveTo(-W, 0); ctx.lineTo(-S * 0.75, 0); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(S * 0.75, 0); ctx.lineTo(W, 0); ctx.stroke();
      // Zigzag
      ctx.beginPath();
      ctx.moveTo(-S * 0.75, 0);
      const steps = 6, sw = (S * 1.5) / steps;
      for (let i = 0; i <= steps; i++) {
        const x = -S * 0.75 + i * sw;
        const y = (i % 2 === 0 ? 0 : (i % 4 === 1 ? -S * 0.35 : S * 0.35));
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.lineTo(S * 0.75, 0);
      ctx.stroke();
      // Value label
      ctx.rotate(0); // label always horizontal
      ctx.save();
      ctx.rotate(-c.rotation * Math.PI / 180);
      ctx.fillStyle = isDark ? '#d4cec6' : '#5c544a';
      ctx.font = `${Math.round(S * 0.55)}px Sora, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(formatVal(c.value, 'Ω'), 0, S * 0.95);
      ctx.fillText(c.label, 0, -S * 0.75);
      ctx.restore();
      break;
    }
    case 'capacitor': {
      ctx.beginPath(); ctx.moveTo(-W, 0); ctx.lineTo(-S * 0.15, 0); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(S * 0.15, 0); ctx.lineTo(W, 0); ctx.stroke();
      ctx.lineWidth = c.selected ? 3 : 2.5;
      ctx.beginPath(); ctx.moveTo(-S * 0.15, -S * 0.7); ctx.lineTo(-S * 0.15, S * 0.7); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(S * 0.15, -S * 0.7); ctx.lineTo(S * 0.15, S * 0.7); ctx.stroke();
      ctx.save();
      ctx.rotate(-c.rotation * Math.PI / 180);
      ctx.fillStyle = isDark ? '#d4cec6' : '#5c544a';
      ctx.font = `${Math.round(S * 0.55)}px Sora, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(formatVal(c.value, 'F'), 0, S * 0.95);
      ctx.fillText(c.label, 0, -S * 0.75);
      ctx.restore();
      break;
    }
    case 'inductor': {
      ctx.beginPath(); ctx.moveTo(-W, 0); ctx.lineTo(-S * 0.75, 0); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(S * 0.75, 0); ctx.lineTo(W, 0); ctx.stroke();
      // Bumps
      ctx.beginPath();
      const nbumps = 4, bw = (S * 1.5) / nbumps;
      for (let i = 0; i < nbumps; i++) {
        const cx2 = -S * 0.75 + bw * (i + 0.5);
        ctx.arc(cx2, 0, bw / 2, Math.PI, 0, false);
      }
      ctx.stroke();
      ctx.save();
      ctx.rotate(-c.rotation * Math.PI / 180);
      ctx.fillStyle = isDark ? '#d4cec6' : '#5c544a';
      ctx.font = `${Math.round(S * 0.55)}px Sora, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(formatVal(c.value, 'H'), 0, S * 0.95);
      ctx.fillText(c.label, 0, -S * 0.75);
      ctx.restore();
      break;
    }
    case 'vsource': case 'acsource': {
      ctx.beginPath(); ctx.moveTo(-W, 0); ctx.lineTo(-S * 0.65, 0); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(S * 0.65, 0); ctx.lineTo(W, 0); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, S * 0.65, 0, Math.PI * 2); ctx.stroke();
      if (c.kind === 'vsource') {
        ctx.fillStyle = c.selected ? amber : green;
        ctx.font = `bold ${Math.round(S * 0.7)}px Sora`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('+', S * 0.32, -S * 0.1);
        ctx.fillStyle = c.selected ? amber : red;
        ctx.fillText('−', -S * 0.32, -S * 0.1);
      } else {
        // AC: draw ~ inside
        ctx.strokeStyle = c.selected ? amber : blue;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let i = 0; i <= 30; i++) {
          const x = -S * 0.4 + (i / 30) * S * 0.8;
          const y = -Math.sin((i / 30) * Math.PI * 2) * S * 0.25;
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      ctx.textBaseline = 'alphabetic';
      ctx.save();
      ctx.rotate(-c.rotation * Math.PI / 180);
      ctx.fillStyle = isDark ? '#d4cec6' : '#5c544a';
      ctx.font = `${Math.round(S * 0.55)}px Sora, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(c.kind === 'acsource' ? `${formatVal(c.value, 'V')}~` : formatVal(c.value, 'V'), 0, S * 1.1);
      ctx.fillText(c.label, 0, -S * 0.85);
      ctx.restore();
      break;
    }
    case 'isource': {
      ctx.beginPath(); ctx.moveTo(-W, 0); ctx.lineTo(-S * 0.65, 0); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(S * 0.65, 0); ctx.lineTo(W, 0); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, S * 0.65, 0, Math.PI * 2); ctx.stroke();
      // Arrow inside
      ctx.strokeStyle = c.selected ? amber : blue;
      ctx.fillStyle = c.selected ? amber : blue;
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(-S * 0.3, 0); ctx.lineTo(S * 0.3, 0); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(S * 0.3, 0);
      ctx.lineTo(S * 0.1, -S * 0.15);
      ctx.lineTo(S * 0.1, S * 0.15);
      ctx.closePath(); ctx.fill();
      ctx.save();
      ctx.rotate(-c.rotation * Math.PI / 180);
      ctx.fillStyle = isDark ? '#d4cec6' : '#5c544a';
      ctx.font = `${Math.round(S * 0.55)}px Sora, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(formatVal(c.value, 'A'), 0, S * 1.1);
      ctx.fillText(c.label, 0, -S * 0.85);
      ctx.restore();
      break;
    }
    case 'diode': case 'led': case 'zener': {
      ctx.beginPath(); ctx.moveTo(-W, 0); ctx.lineTo(-S * 0.5, 0); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(S * 0.5, 0); ctx.lineTo(W, 0); ctx.stroke();
      // Triangle + bar
      ctx.fillStyle = c.selected ? amber : (c.kind === 'led' ? '#22c55e' : isDark ? '#e8e4de' : '#1a1612');
      ctx.beginPath();
      ctx.moveTo(-S * 0.5, -S * 0.45);
      ctx.lineTo(-S * 0.5, S * 0.45);
      ctx.lineTo(S * 0.5, 0);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      // Cathode bar
      ctx.lineWidth = c.selected ? 3 : 2.5;
      ctx.beginPath();
      if (c.kind === 'zener') {
        ctx.moveTo(S * 0.5, -S * 0.5); ctx.lineTo(S * 0.5, S * 0.5);
        ctx.moveTo(S * 0.5, -S * 0.5); ctx.lineTo(S * 0.35, -S * 0.35);
        ctx.moveTo(S * 0.5, S * 0.5); ctx.lineTo(S * 0.65, S * 0.35);
      } else {
        ctx.moveTo(S * 0.5, -S * 0.5); ctx.lineTo(S * 0.5, S * 0.5);
      }
      ctx.stroke();
      if (c.kind === 'led') {
        // Draw two arrow lines for light emission
        ctx.strokeStyle = '#22c55e'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(S * 0.2, -S * 0.6); ctx.lineTo(S * 0.55, -S * 0.95); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-S * 0.05, -S * 0.6); ctx.lineTo(S * 0.3, -S * 0.95); ctx.stroke();
      }
      ctx.save();
      ctx.rotate(-c.rotation * Math.PI / 180);
      ctx.fillStyle = isDark ? '#d4cec6' : '#5c544a';
      ctx.font = `${Math.round(S * 0.55)}px Sora, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(c.label, 0, S * 0.95);
      ctx.restore();
      break;
    }
    case 'npn': case 'pnp': {
      // Base line (left)
      ctx.beginPath(); ctx.moveTo(-W, 0); ctx.lineTo(-S * 0.3, 0); ctx.stroke();
      // Vertical bar
      ctx.lineWidth = c.selected ? 3 : 2.5;
      ctx.beginPath(); ctx.moveTo(-S * 0.3, -S * 0.7); ctx.lineTo(-S * 0.3, S * 0.7); ctx.stroke();
      ctx.lineWidth = c.selected ? 2.5 : 2;
      // Collector (top-right)
      ctx.beginPath(); ctx.moveTo(-S * 0.3, -S * 0.45); ctx.lineTo(W, -W); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(W, -W); ctx.lineTo(W, -W - S * 0.3); ctx.stroke();
      // Emitter (bottom-right) with arrow
      ctx.beginPath(); ctx.moveTo(-S * 0.3, S * 0.45); ctx.lineTo(W, W); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(W, W); ctx.lineTo(W, W + S * 0.3); ctx.stroke();
      // Arrow on emitter
      const arrowDir = c.kind === 'npn' ? 1 : -1;
      const ax = W * 0.7, ay = W * 0.7;
      ctx.fillStyle = c.selected ? amber : stroke;
      ctx.beginPath();
      ctx.translate(ax * arrowDir * 0.15, ay * arrowDir * 0.15);
      ctx.rotate(Math.PI / 4 * arrowDir);
      ctx.moveTo(0, 0); ctx.lineTo(-S * 0.2, -S * 0.1); ctx.lineTo(-S * 0.2, S * 0.1);
      ctx.closePath(); ctx.fill();
      ctx.restore();
      ctx.save();
      ctx.translate(c.gx * S, c.gy * S);
      ctx.fillStyle = isDark ? '#d4cec6' : '#5c544a';
      ctx.font = `${Math.round(S * 0.55)}px Sora, sans-serif`;
      ctx.textAlign = 'left';
      ctx.fillText(c.label, S * 2.2, S * 0.5);
      ctx.restore();
      return; // already restored
    }
    case 'nmos': case 'pmos': {
      // Gate line
      ctx.beginPath(); ctx.moveTo(-W, 0); ctx.lineTo(-S * 0.4, 0); ctx.stroke();
      // Gate plate
      ctx.lineWidth = c.selected ? 3 : 2.5;
      ctx.beginPath(); ctx.moveTo(-S * 0.4, -S * 0.7); ctx.lineTo(-S * 0.4, S * 0.7); ctx.stroke();
      ctx.lineWidth = c.selected ? 2.5 : 2;
      // Oxide gap then channel
      ctx.beginPath(); ctx.moveTo(-S * 0.1, -S * 0.7); ctx.lineTo(-S * 0.1, S * 0.7); ctx.stroke();
      // Drain (top)
      ctx.beginPath(); ctx.moveTo(-S * 0.1, -S * 0.45); ctx.lineTo(W, -S * 0.45); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(W, -S * 0.45); ctx.lineTo(W, -W); ctx.stroke();
      // Source (bottom)
      ctx.beginPath(); ctx.moveTo(-S * 0.1, S * 0.45); ctx.lineTo(W, S * 0.45); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(W, S * 0.45); ctx.lineTo(W, W); ctx.stroke();
      // Arrow on source
      ctx.fillStyle = c.selected ? amber : stroke;
      ctx.beginPath();
      ctx.moveTo(S * 0.1, 0); ctx.lineTo(-S * 0.25, -S * 0.2); ctx.lineTo(-S * 0.25, S * 0.2);
      ctx.closePath(); ctx.fill();
      ctx.save();
      ctx.translate(0, 0);
      ctx.fillStyle = isDark ? '#d4cec6' : '#5c544a';
      ctx.font = `${Math.round(S * 0.55)}px Sora, sans-serif`;
      ctx.textAlign = 'left';
      ctx.fillText(c.label, S * 2.2, S * 0.5);
      ctx.restore();
      break;
    }
    case 'opamp': {
      // Triangle
      ctx.beginPath();
      ctx.moveTo(-W, -S * 1.5);
      ctx.lineTo(-W, S * 1.5);
      ctx.lineTo(W, 0);
      ctx.closePath(); ctx.stroke();
      // Input lines
      ctx.beginPath(); ctx.moveTo(-W * 2, -S); ctx.lineTo(-W, -S); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-W * 2, S); ctx.lineTo(-W, S); ctx.stroke();
      // Output line
      ctx.beginPath(); ctx.moveTo(W, 0); ctx.lineTo(W * 2, 0); ctx.stroke();
      // +/- labels inside
      ctx.fillStyle = isDark ? '#9c9488' : '#5c544a';
      ctx.font = `bold ${Math.round(S * 0.6)}px Sora`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('+', -S * 0.8, -S);
      ctx.fillText('−', -S * 0.8, S);
      ctx.textBaseline = 'alphabetic';
      ctx.save();
      ctx.rotate(-c.rotation * Math.PI / 180);
      ctx.fillStyle = isDark ? '#d4cec6' : '#5c544a';
      ctx.font = `${Math.round(S * 0.55)}px Sora, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(c.label, 0, -S * 2);
      ctx.restore();
      break;
    }
    case 'ground': {
      ctx.beginPath(); ctx.moveTo(0, -S); ctx.lineTo(0, 0); ctx.stroke();
      ctx.lineWidth = c.selected ? 3 : 2.5;
      ctx.beginPath(); ctx.moveTo(-S * 0.6, 0); ctx.lineTo(S * 0.6, 0); ctx.stroke();
      ctx.lineWidth = c.selected ? 2.5 : 2;
      ctx.beginPath(); ctx.moveTo(-S * 0.35, S * 0.3); ctx.lineTo(S * 0.35, S * 0.3); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-S * 0.12, S * 0.6); ctx.lineTo(S * 0.12, S * 0.6); ctx.stroke();
      break;
    }
    case 'vcc': {
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, S * 0.7); ctx.stroke();
      ctx.fillStyle = c.selected ? amber : (isDark ? '#f59e0b' : '#d97706');
      ctx.beginPath();
      ctx.moveTo(0, S * 1.5);
      ctx.lineTo(-S * 0.6, S * 0.7);
      ctx.lineTo(S * 0.6, S * 0.7);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = isDark ? '#d4cec6' : '#5c544a';
      ctx.font = `bold ${Math.round(S * 0.55)}px Sora`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(`${c.value}V`, 0, S * 2);
      ctx.textBaseline = 'alphabetic';
      break;
    }
    case 'switch': {
      ctx.beginPath(); ctx.moveTo(-W, 0); ctx.lineTo(-S * 0.5, 0); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(S * 0.5, 0); ctx.lineTo(W, 0); ctx.stroke();
      // Pivot dot
      ctx.fillStyle = c.selected ? amber : stroke;
      ctx.beginPath(); ctx.arc(-S * 0.5, 0, S * 0.12, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(S * 0.5, 0, S * 0.12, 0, Math.PI * 2); ctx.fill();
      // Arm
      ctx.strokeStyle = c.selected ? amber : stroke;
      ctx.beginPath();
      ctx.moveTo(-S * 0.5, 0);
      if (c.closed) ctx.lineTo(S * 0.5, 0);
      else ctx.lineTo(S * 0.3, -S * 0.5);
      ctx.stroke();
      ctx.save();
      ctx.rotate(-c.rotation * Math.PI / 180);
      ctx.fillStyle = isDark ? '#d4cec6' : '#5c544a';
      ctx.font = `${Math.round(S * 0.55)}px Sora, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(c.label, 0, -S * 0.8);
      ctx.restore();
      break;
    }
    case 'junction': {
      ctx.fillStyle = c.selected ? amber : dimStroke;
      ctx.beginPath(); ctx.arc(0, 0, S * 0.2, 0, Math.PI * 2); ctx.fill();
      break;
    }
    default:
      // Generic box
      ctx.strokeRect(-S, -S * 0.5, S * 2, S);
      break;
  }

  // Draw simulation overlay (current annotation)
  if (simResults?.ok && simResults.branchCurrents[c.id] !== undefined) {
    const I = simResults.branchCurrents[c.id];
    if (Math.abs(I) > 1e-12) {
      ctx.save();
      ctx.rotate(-c.rotation * Math.PI / 180);
      ctx.fillStyle = blue;
      ctx.font = `${Math.round(S * 0.5)}px Sora, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(`${formatVal(I, 'A')}`, 0, -S * 1.3);
      ctx.restore();
    }
  }

  ctx.restore();
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function CircuitBuilder() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const oscRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [components, setComponents] = useState<SchComponent[]>(DEFAULT_COMPS);
  const [wires, setWires] = useState<Wire[]>(DEFAULT_WIRES);
  const [mode, setMode] = useState<EditorMode>('select');
  const [placing, setPlacing] = useState<ComponentKind | null>(null);
  const [placingDef, setPlacingDef] = useState<PalItem | null>(null);
  const [ghostPos, setGhostPos] = useState<{ gx: number; gy: number } | null>(null);
  const [wireStart, setWireStart] = useState<{ gx: number; gy: number } | null>(null);
  const [wireCursor, setWireCursor] = useState<{ gx: number; gy: number } | null>(null);
  const [viewport, setViewport] = useState<Viewport>({ scale: 1, tx: 0, ty: 0 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [simResults, setSimResults] = useState<SimResults | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisMode>('transient');
  const [probes, setProbes] = useState<Probe[]>([]);
  const [showOsc, setShowOsc] = useState(true);
  const [tMax, setTMax] = useState(0.05); // 50 ms — 3 full cycles of 60 Hz
  const [dt] = useState(1e-4); // 0.1 ms step
  const [isDark, setIsDark] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [history, setHistory] = useState<{ components: SchComponent[]; wires: Wire[] }[]>([]);
  const [spaceDown, setSpaceDown] = useState(false);
  const panRef = useRef<{ startX: number; startY: number; tx: number; ty: number } | null>(null);
  // Pre-seed counters to match the default circuit labels
  const labelCounters = useRef<Record<string, number>>({ V: 1, D: 1, R: 1, C: 1, J: 2, GND: 3 });

  // Track dark mode
  useEffect(() => {
    const el = document.documentElement;
    setIsDark(el.getAttribute('data-theme') === 'dark');
    const obs = new MutationObserver(() => setIsDark(el.getAttribute('data-theme') === 'dark'));
    obs.observe(el, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);

  // On mount: auto-run transient on the default circuit so the oscilloscope
  // shows real waveforms immediately. We probe the AC input node and the
  // rectified output node to demonstrate the half-wave rectification + smoothing.
  useEffect(() => {
    const r = solveTransient(DEFAULT_COMPS, DEFAULT_WIRES, 0.05, 1e-4, []);
    if (!r.ok || !r.nodeVoltages) return;
    const allNodes = Object.keys(r.nodeVoltages).filter(nk => nk !== 'GND');
    // Pick up to 2 nodes: prefer nodes connected to V1 and the output node
    const nodeKeys = allNodes.slice(0, 2);
    if (nodeKeys.length === 0) return;
    const r2 = solveTransient(DEFAULT_COMPS, DEFAULT_WIRES, 0.05, 1e-4, nodeKeys);
    setProbes(nodeKeys.map((nk, i) => ({ nodeKey: nk, color: PROBE_COLORS[i], label: nk })));
    setSimResults(r2);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-run DC whenever circuit changes (DC mode only)
  useEffect(() => {
    if (analysis !== 'dc') return;
    const r = solveDC(components, wires);
    setSimResults(r);
  }, [components, wires, analysis]);

  // Node map for coloring wires
  const nodeWireColors = useMemo(() => {
    if (!simResults?.ok) return new Map<string, string>();
    const { nodeVoltages } = simResults;
    const vmax = Math.max(...Object.values(nodeVoltages).map(Math.abs), 0.001);
    const { pinNodeMap } = detectNodes(components, wires);
    // Build grid-key → voltage map
    const gridColors = new Map<string, string>();
    for (const [pinKey, nodeKey] of pinNodeMap) {
      const [cid, pidx] = pinKey.split(':');
      const comp = components.find(c => c.id === cid);
      if (!comp) continue;
      const pins = getPins(comp);
      const pin = pins[parseInt(pidx)];
      if (!pin) continue;
      const gk = `${pin.gx},${pin.gy}`;
      const v = nodeVoltages[nodeKey] ?? 0;
      gridColors.set(gk, voltageColor(v, vmax));
    }
    return gridColors;
  }, [simResults, components, wires]);

  // Canvas draw
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const par = canvas.parentElement;
    if (!par) return;
    const rect = par.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const W = rect.width, H = rect.height;
    const bg = isDark ? '#0f0e0c' : '#faf8f5';
    const dotColor = isDark ? '#2a2520' : '#e8e0d4';
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Grid dots
    const { scale, tx, ty } = viewport;
    const gs = GRID * scale;
    const offX = ((tx % gs) + gs) % gs;
    const offY = ((ty % gs) + gs) % gs;
    ctx.fillStyle = dotColor;
    for (let x = offX; x < W; x += gs) {
      for (let y = offY; y < H; y += gs) {
        ctx.beginPath(); ctx.arc(x, y, 1.2, 0, Math.PI * 2); ctx.fill();
      }
    }

    // Apply viewport transform
    ctx.save();
    ctx.translate(tx, ty);
    ctx.scale(scale, scale);

    const S = GRID;

    // Draw wires
    const { pinNodeMap } = simResults?.ok ? detectNodes(components, wires) : { pinNodeMap: new Map<string, string>() };
    const nodeVoltages = simResults?.ok ? simResults.nodeVoltages : {};
    const vmax = simResults?.ok ? Math.max(...Object.values(nodeVoltages).map(Math.abs), 0.001) : 1;

    // Build node→color map from wire grid pos
    const getWireColor = (gx1: number, gy1: number, gx2: number, gy2: number): string => {
      // Try to find a component pin at these positions
      const midX = (gx1 + gx2) / 2, midY = (gy1 + gy2) / 2;
      const testKeys = [`${gx1},${gy1}`, `${gx2},${gy2}`, `${Math.round(midX)},${Math.round(midY)}`];
      for (const gk of testKeys) {
        const col = nodeWireColors.get(gk);
        if (col) return col;
      }
      // Fallback: find matching pin
      for (const [pk, nk] of pinNodeMap) {
        const [cid, pidx] = pk.split(':');
        const comp = components.find(c => c.id === cid);
        if (!comp) continue;
        const pins = getPins(comp);
        const pin = pins[parseInt(pidx)];
        if (!pin) continue;
        if ((pin.gx === gx1 && pin.gy === gy1) || (pin.gx === gx2 && pin.gy === gy2)) {
          const v = nodeVoltages[nk] ?? 0;
          return voltageColor(v, vmax);
        }
      }
      return isDark ? '#6b6560' : '#9c9488';
    };

    for (const w of wires) {
      const color = getWireColor(w.x1, w.y1, w.x2, w.y2);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(w.x1 * S, w.y1 * S);
      ctx.lineTo(w.x2 * S, w.y2 * S);
      ctx.stroke();
    }

    // Wire-in-progress preview
    if (mode === 'wire' && wireStart && wireCursor) {
      ctx.strokeStyle = isDark ? '#f59e0b80' : '#d9770680';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(wireStart.gx * S, wireStart.gy * S);
      ctx.lineTo(wireCursor.gx * S, wireStart.gy * S);
      ctx.lineTo(wireCursor.gx * S, wireCursor.gy * S);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Draw components
    for (const c of components) {
      drawComponent(ctx, c, isDark, simResults);
    }

    // Node voltage labels on schematic
    if (simResults?.ok) {
      const drawn = new Set<string>();
      for (const [pk, nk] of pinNodeMap) {
        if (drawn.has(nk)) continue;
        drawn.add(nk);
        const [cid, pidx] = pk.split(':');
        const comp = components.find(c => c.id === cid);
        if (!comp) continue;
        const pins = getPins(comp);
        const pin = pins[parseInt(pidx)];
        if (!pin) continue;
        const v = nodeVoltages[nk] ?? 0;
        if (nk === 'GND') continue;
        const px = pin.gx * S, py = pin.gy * S;
        ctx.fillStyle = isDark ? 'rgba(15,14,12,0.85)' : 'rgba(250,248,245,0.9)';
        const txt = `${nk}: ${formatVal(v, 'V')}`;
        ctx.font = `bold ${Math.round(S * 0.52)}px Sora, sans-serif`;
        const tw = ctx.measureText(txt).width;
        ctx.fillRect(px - tw / 2 - 4, py - S * 1.4 - 2, tw + 8, S * 0.75);
        ctx.fillStyle = voltageColor(v, vmax);
        ctx.textAlign = 'center';
        ctx.fillText(txt, px, py - S * 0.8);
      }
    }

    // Ghost component while placing
    if (mode === 'place' && ghostPos && placingDef) {
      const ghost: SchComponent = {
        id: '__ghost__',
        kind: placing!,
        gx: ghostPos.gx, gy: ghostPos.gy,
        rotation: 0, value: placingDef.defaultValue,
        value2: placingDef.defaultV2, label: '', selected: false,
      };
      ctx.globalAlpha = 0.45;
      drawComponent(ctx, ghost, isDark, null);
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }, [components, wires, viewport, mode, ghostPos, wireStart, wireCursor, isDark, simResults, placing, placingDef, nodeWireColors]);

  // Oscilloscope draw
  useEffect(() => {
    const canvas = oscRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const par = canvas.parentElement;
    if (!par) return;
    const rect = par.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    const W = rect.width, H = rect.height;

    ctx.fillStyle = isDark ? '#0a0908' : '#f3efe8';
    ctx.fillRect(0, 0, W, H);

    if (!simResults?.ok || !simResults.waveforms || !simResults.time || probes.length === 0) {
      ctx.fillStyle = isDark ? '#3d3530' : '#9c9488';
      ctx.font = '13px Sora, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Run Transient analysis to see waveforms', W / 2, H / 2);
      return;
    }

    const pad = { l: 52, r: 12, t: 12, b: 28 };
    const pw = W - pad.l - pad.r, ph = H - pad.t - pad.b;
    const time = simResults.time!;
    const wf = simResults.waveforms!;

    // Grid
    const gridColor = isDark ? '#1e1c18' : '#e8e0d4';
    ctx.strokeStyle = gridColor; ctx.lineWidth = 1;
    for (let i = 0; i <= 5; i++) {
      const y = pad.t + (i / 5) * ph;
      ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(pad.l + pw, y); ctx.stroke();
    }
    for (let i = 0; i <= 8; i++) {
      const x = pad.l + (i / 8) * pw;
      ctx.beginPath(); ctx.moveTo(x, pad.t); ctx.lineTo(x, pad.t + ph); ctx.stroke();
    }

    // Auto-scale
    let vmin = Infinity, vmax2 = -Infinity;
    for (const p of probes) {
      const data = wf[p.nodeKey];
      if (!data) continue;
      for (const v of data) { if (v < vmin) vmin = v; if (v > vmax2) vmax2 = v; }
    }
    if (!isFinite(vmin)) { vmin = -1; vmax2 = 1; }
    if (Math.abs(vmax2 - vmin) < 0.001) { vmin -= 1; vmax2 += 1; }
    const vRange = vmax2 - vmin;
    const tEnd = time[time.length - 1] || 1;

    const toCanvasX = (t: number) => pad.l + (t / tEnd) * pw;
    const toCanvasY = (v: number) => pad.t + ph - ((v - vmin) / vRange) * ph;

    // Axis labels
    ctx.fillStyle = isDark ? '#9c9488' : '#5c544a';
    ctx.font = '11px Sora, sans-serif';
    ctx.textAlign = 'right';
    for (let i = 0; i <= 5; i++) {
      const v = vmin + (i / 5) * vRange;
      ctx.fillText(formatVal(v, 'V'), pad.l - 4, pad.t + ph - (i / 5) * ph + 4);
    }
    ctx.textAlign = 'center';
    for (let i = 0; i <= 4; i++) {
      const t2 = (i / 4) * tEnd;
      ctx.fillText(formatVal(t2, 's'), pad.l + (i / 4) * pw, pad.t + ph + 18);
    }

    // Waveforms
    for (const probe of probes) {
      const data = wf[probe.nodeKey];
      if (!data || data.length === 0) continue;
      ctx.strokeStyle = probe.color;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      data.forEach((v, i) => {
        const x = toCanvasX(time[i]), y = toCanvasY(v);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      ctx.stroke();
      // Legend
      const li = probes.indexOf(probe);
      ctx.fillStyle = probe.color;
      ctx.font = 'bold 11px Sora, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`${probe.label} (${probe.nodeKey})`, pad.l + 8 + li * 100, pad.t + 14);
    }
  }, [simResults, probes, isDark]);

  // Screen → grid
  const screenToGrid = useCallback((sx: number, sy: number) => {
    const gx = Math.round((sx - viewport.tx) / (GRID * viewport.scale));
    const gy = Math.round((sy - viewport.ty) / (GRID * viewport.scale));
    return { gx, gy };
  }, [viewport]);

  const getCanvasPos = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { sx: 0, sy: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    return { sx: clientX - rect.left, sy: clientY - rect.top };
  }, []);

  const nextLabel = useCallback((kind: ComponentKind) => {
    const prefix = labelPrefix(kind);
    const n = (labelCounters.current[prefix] ?? 0) + 1;
    labelCounters.current[prefix] = n;
    return `${prefix}${n}`;
  }, []);

  const pushHistory = useCallback(() => {
    setHistory(h => [...h.slice(-30), { components: [...components], wires: [...wires] }]);
  }, [components, wires]);

  const undo = useCallback(() => {
    setHistory(h => {
      if (h.length === 0) return h;
      const prev = h[h.length - 1];
      setComponents(prev.components);
      setWires(prev.wires);
      return h.slice(0, -1);
    });
  }, []);

  // Mouse/touch handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const { sx, sy } = getCanvasPos(e);

    // Pan with middle button or space+left
    if (e.button === 1 || (spaceDown && e.button === 0)) {
      panRef.current = { startX: e.clientX, startY: e.clientY, tx: viewport.tx, ty: viewport.ty };
      return;
    }

    if (mode === 'place' && placingDef) {
      const { gx, gy } = screenToGrid(sx, sy);
      pushHistory();
      const newComp: SchComponent = {
        id: `${Date.now()}`, kind: placing!, gx, gy,
        rotation: 0, value: placingDef.defaultValue, value2: placingDef.defaultV2,
        label: nextLabel(placing!), selected: false,
        closed: placing === 'switch' ? true : undefined,
      };
      setComponents(prev => prev.map(c => ({ ...c, selected: false })).concat(newComp));
      setSelectedId(newComp.id);
      return;
    }

    if (mode === 'wire') {
      const { gx, gy } = screenToGrid(sx, sy);
      if (!wireStart) {
        setWireStart({ gx, gy });
      } else {
        // Complete wire: L-shape via two segments
        if (wireStart.gx !== gx || wireStart.gy !== gy) {
          pushHistory();
          const newWires: Wire[] = [];
          if (wireStart.gx !== gx) {
            newWires.push({ id: `w${Date.now()}a`, x1: wireStart.gx, y1: wireStart.gy, x2: gx, y2: wireStart.gy });
          }
          if (wireStart.gy !== gy) {
            newWires.push({ id: `w${Date.now()}b`, x1: gx, y1: wireStart.gy, x2: gx, y2: gy });
          }
          setWires(prev => [...prev, ...newWires]);
        }
        setWireStart(null); setWireCursor(null);
      }
      return;
    }

    // Select mode: check hit on component
    const S = GRID;
    const wx = (sx - viewport.tx) / viewport.scale;
    const wy = (sy - viewport.ty) / viewport.scale;
    let hit: SchComponent | null = null;
    for (let i = components.length - 1; i >= 0; i--) {
      const c = components[i];
      const dx = wx - c.gx * S, dy = wy - c.gy * S;
      const hitRadius = (c.kind === 'ground' || c.kind === 'vcc' || c.kind === 'junction') ? S * 0.8 : S * 2.2;
      if (Math.sqrt(dx * dx + dy * dy) < hitRadius) { hit = c; break; }
    }
    if (hit) {
      setSelectedId(hit.id);
      setComponents(prev => prev.map(c => ({ ...c, selected: c.id === hit!.id })));
    } else {
      setSelectedId(null);
      setComponents(prev => prev.map(c => ({ ...c, selected: false })));
    }
  }, [mode, placingDef, placing, viewport, spaceDown, wireStart, components, screenToGrid, getCanvasPos, pushHistory, nextLabel]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (panRef.current) {
      const dx = e.clientX - panRef.current.startX;
      const dy = e.clientY - panRef.current.startY;
      setViewport(v => ({ ...v, tx: panRef.current!.tx + dx, ty: panRef.current!.ty + dy }));
      return;
    }
    const { sx, sy } = getCanvasPos(e);
    const { gx, gy } = screenToGrid(sx, sy);
    if (mode === 'place') setGhostPos({ gx, gy });
    if (mode === 'wire' && wireStart) setWireCursor({ gx, gy });

    // Drag selected component
    if (mode === 'select' && e.buttons === 1 && selectedId) {
      setComponents(prev => prev.map(c =>
        c.id === selectedId ? { ...c, gx, gy } : c
      ));
    }
  }, [mode, wireStart, selectedId, getCanvasPos, screenToGrid]);

  const handleMouseUp = useCallback(() => { panRef.current = null; }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const { sx, sy } = getCanvasPos(e as unknown as React.MouseEvent);
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    setViewport(v => {
      const newScale = Math.max(0.2, Math.min(8, v.scale * factor));
      const ratio = newScale / v.scale;
      return {
        scale: newScale,
        tx: sx - ratio * (sx - v.tx),
        ty: sy - ratio * (sy - v.ty),
      };
    });
  }, [getCanvasPos]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === ' ') { setSpaceDown(true); e.preventDefault(); }
      if (e.key === 'Escape') {
        setMode('select'); setPlacing(null); setPlacingDef(null); setGhostPos(null);
        setWireStart(null); setWireCursor(null);
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId && !(e.target as HTMLElement).matches('input')) {
        pushHistory();
        setComponents(prev => prev.filter(c => c.id !== selectedId));
        setSelectedId(null);
      }
      if ((e.key === 'e' || e.key === 'E') && selectedId && !(e.target as HTMLElement).matches('input')) {
        setComponents(prev => prev.map(c =>
          c.id === selectedId ? { ...c, rotation: (c.rotation + 90) % 360 } : c
        ));
      }
      if ((e.key === 'z' || e.key === 'Z') && (e.metaKey || e.ctrlKey)) { e.preventDefault(); undo(); }
      if ((e.key === 'w' || e.key === 'W') && !(e.target as HTMLElement).matches('input')) {
        setMode('wire');
      }
    };
    const onKeyUp = (e: KeyboardEvent) => { if (e.key === ' ') setSpaceDown(false); };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => { window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp); };
  }, [selectedId, pushHistory, undo]);

  const runTransient = useCallback(() => {
    const nodeKeys = probes.map(p => p.nodeKey);
    const r = solveTransient(components, wires, tMax, dt, nodeKeys);
    setSimResults(r);
    setAnalysis('transient');
  }, [components, wires, tMax, dt, probes]);

  const addProbe = useCallback(() => {
    if (!simResults?.ok) return;
    const available = Object.keys(simResults.nodeVoltages).filter(
      nk => nk !== 'GND' && !probes.find(p => p.nodeKey === nk)
    );
    if (available.length === 0) return;
    const nk = available[0];
    const color = PROBE_COLORS[probes.length % PROBE_COLORS.length];
    setProbes(prev => [...prev, { nodeKey: nk, color, label: nk }]);
  }, [simResults, probes]);

  const selectedComp = components.find(c => c.id === selectedId) ?? null;
  const cursorStyle = spaceDown ? 'grab' : mode === 'place' ? 'crosshair' : mode === 'wire' ? 'cell' : 'default';

  const border = isDark ? '#27272a' : '#e4e4e7';
  const textDim = isDark ? '#71717a' : '#a1a1aa';
  const textMid = isDark ? '#a1a1aa' : '#52525b';

  // Button style helpers
  const pillBtn = (active: boolean, color = '#d97706'): React.CSSProperties => ({
    padding: '4px 14px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 700,
    cursor: 'pointer', letterSpacing: 0.3, border: `1px solid ${active ? color : border}`,
    background: active ? `${color}22` : 'transparent', color: active ? color : textMid,
    transition: 'all 0.15s',
  });
  const ghostBtn: React.CSSProperties = {
    padding: '4px 10px', borderRadius: 6, fontSize: '0.72rem', fontWeight: 500,
    cursor: 'pointer', border: `1px solid ${border}`, background: 'transparent', color: textMid,
  };
  const oscHeaderBtn: React.CSSProperties = {
    padding: '2px 8px', borderRadius: 4, fontSize: '0.62rem', cursor: 'pointer',
    border: '1px solid #0a3320', background: 'transparent', color: '#4ade80',
    fontFamily: 'monospace',
  };

  const sidebarContent = (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* ── Palette ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0 8px' }}>
        <div style={{ padding: '8px 14px 4px', fontSize: '0.58rem', fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: textDim }}>
          Components
        </div>
        {PALETTE.map(group => (
          <div key={group.group}>
            <div style={{ fontSize: '0.6rem', fontWeight: 700, color: textDim, textTransform: 'uppercase', letterSpacing: 1.5, padding: '8px 14px 3px', borderTop: `1px solid ${border}`, marginTop: 4 }}>
              {group.group}
            </div>
            {group.items.map(item => (
              <button key={item.kind}
                onClick={() => {
                  if (placing === item.kind && mode === 'place') { setMode('select'); setPlacing(null); setPlacingDef(null); }
                  else { setMode('place'); setPlacing(item.kind); setPlacingDef(item); }
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  width: '100%', padding: '5px 14px', marginBottom: 1,
                  border: 'none', borderLeft: `3px solid ${placing === item.kind && mode === 'place' ? '#3b82f6' : 'transparent'}`,
                  background: placing === item.kind && mode === 'place' ? (isDark ? 'rgba(59,130,246,0.08)' : 'rgba(59,130,246,0.06)') : 'transparent',
                  color: placing === item.kind && mode === 'place' ? '#3b82f6' : (isDark ? '#d4d4d8' : '#3f3f46'),
                  fontSize: '0.75rem', cursor: 'pointer', textAlign: 'left',
                  transition: 'all 0.1s',
                }}>
                <span style={{
                  width: 24, height: 20, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: placing === item.kind && mode === 'place' ? 'rgba(59,130,246,0.15)' : (isDark ? '#27272a' : '#f4f4f5'),
                  fontSize: '0.58rem', fontWeight: 800, flexShrink: 0,
                  color: placing === item.kind && mode === 'place' ? '#3b82f6' : textDim,
                  fontFamily: 'monospace', letterSpacing: 0,
                }}>
                  {item.key}
                </span>
                {item.label}
              </button>
            ))}
          </div>
        ))}
      </div>

      {/* ── Properties + Simulation ── */}
      <div style={{ borderTop: `1px solid ${border}`, flexShrink: 0, overflowY: 'auto', maxHeight: '48%', padding: '10px 14px 12px' }}>
        <div style={{ fontSize: '0.58rem', fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: textDim, marginBottom: 8 }}>
          {selectedComp ? `${selectedComp.label} · ${selectedComp.kind}` : 'Properties'}
        </div>

        {selectedComp ? (
          <>
            {editingId === selectedComp.id ? (
              <div style={{ marginBottom: 8 }}>
                <input autoFocus value={editValue}
                  onChange={e => setEditValue(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      const v = parseFloat(editValue);
                      if (!isNaN(v)) setComponents(prev => prev.map(c => c.id === selectedComp.id ? { ...c, value: v } : c));
                      setEditingId(null);
                    }
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                  style={{
                    width: '100%', padding: '5px 8px', borderRadius: 6, fontSize: '0.8rem',
                    border: '1px solid #3b82f6', background: isDark ? '#18181b' : '#fff',
                    color: isDark ? '#f4f4f5' : '#18181b', boxSizing: 'border-box',
                  }}
                />
                <div style={{ fontSize: '0.62rem', color: textDim, marginTop: 2 }}>Enter to confirm · Esc to cancel</div>
              </div>
            ) : (
              <button onClick={() => { setEditingId(selectedComp.id); setEditValue(String(selectedComp.value)); }}
                style={{
                  width: '100%', padding: '5px 8px', borderRadius: 6, fontSize: '0.78rem', fontWeight: 600,
                  cursor: 'pointer', textAlign: 'left', marginBottom: 8, boxSizing: 'border-box',
                  border: `1px solid ${border}`, background: isDark ? '#18181b' : '#fff',
                  color: isDark ? '#f4f4f5' : '#18181b', display: 'flex', justifyContent: 'space-between',
                }}>
                <span>{formatVal(selectedComp.value, unitSuffix(selectedComp.kind))}</span>
                <span style={{ color: textDim, fontWeight: 400, fontSize: '0.7rem' }}>edit</span>
              </button>
            )}
            <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
              <button onClick={() => setComponents(prev => prev.map(c => c.id === selectedComp.id ? { ...c, rotation: (c.rotation + 90) % 360 } : c))}
                style={{ flex: 1, padding: '4px 0', borderRadius: 5, fontSize: '0.7rem', cursor: 'pointer', border: `1px solid ${border}`, background: 'transparent', color: isDark ? '#d4d4d8' : '#3f3f46' }}>
                ↻ Rotate (E)
              </button>
              <button onClick={() => { pushHistory(); setComponents(prev => prev.filter(c => c.id !== selectedComp.id)); setSelectedId(null); }}
                style={{ flex: 1, padding: '4px 0', borderRadius: 5, fontSize: '0.7rem', cursor: 'pointer', border: '1px solid rgba(239,68,68,0.4)', background: 'transparent', color: '#ef4444' }}>
                ✕ Delete
              </button>
            </div>
            {selectedComp.kind === 'switch' && (
              <button onClick={() => setComponents(prev => prev.map(c => c.id === selectedComp.id ? { ...c, closed: !c.closed } : c))}
                style={{
                  width: '100%', padding: '5px', borderRadius: 6, fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer', marginBottom: 8,
                  border: `1px solid ${selectedComp.closed ? '#10b981' : '#ef4444'}`,
                  background: selectedComp.closed ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                  color: selectedComp.closed ? '#10b981' : '#ef4444',
                }}>
                {selectedComp.closed ? '⬤ Closed' : '○ Open'}
              </button>
            )}
            {simResults?.ok && (
              <div>
                {simResults.branchCurrents[selectedComp.id] !== undefined && (
                  <div style={{ fontSize: '0.72rem', color: '#3b82f6', marginBottom: 2, fontFamily: 'monospace' }}>
                    I = {formatVal(simResults.branchCurrents[selectedComp.id], 'A')}
                  </div>
                )}
                {simResults.power[selectedComp.id] !== undefined && (
                  <div style={{ fontSize: '0.72rem', color: '#f59e0b', fontFamily: 'monospace' }}>
                    P = {formatVal(simResults.power[selectedComp.id], 'W')}
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <div style={{ fontSize: '0.73rem', color: textDim, lineHeight: 1.5 }}>
            Click any component to inspect values, edit, rotate, or delete it.
          </div>
        )}

        {simResults?.ok && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: '0.58rem', fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: textDim, marginBottom: 6 }}>Node Voltages</div>
            {Object.entries(simResults.nodeVoltages)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([nk, v]) => (
                <div key={nk} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '3px 0', borderBottom: `1px solid ${border}`,
                }}>
                  <span style={{ fontSize: '0.7rem', fontFamily: 'monospace', color: isDark ? '#d4d4d8' : '#3f3f46' }}>{nk}</span>
                  <span style={{ fontSize: '0.7rem', fontFamily: 'monospace', color: voltageColor(v, Math.max(...Object.values(simResults.nodeVoltages).map(Math.abs), 0.001)) }}>
                    {formatVal(v, 'V')}
                  </span>
                </div>
              ))}
            {analysis === 'transient' && (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: '0.58rem', fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: textDim, marginBottom: 5 }}>Probes</div>
                {Object.keys(simResults.nodeVoltages).filter(nk => nk !== 'GND').map(nk => {
                  const existing = probes.find(p => p.nodeKey === nk);
                  return (
                    <button key={nk} onClick={() => {
                      if (existing) setProbes(prev => prev.filter(p => p.nodeKey !== nk));
                      else { const color = PROBE_COLORS[probes.length % PROBE_COLORS.length]; setProbes(prev => [...prev, { nodeKey: nk, color, label: nk }]); }
                    }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        width: '100%', padding: '3px 6px', marginBottom: 2, borderRadius: 5, fontSize: '0.7rem',
                        cursor: 'pointer', textAlign: 'left',
                        border: `1px solid ${existing ? existing.color : border}`,
                        background: existing ? `${existing.color}18` : 'transparent',
                        color: existing ? existing.color : textMid,
                      }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: existing ? existing.color : border, display: 'inline-block', flexShrink: 0 }} />
                      {nk}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {simResults && !simResults.ok && (
          <div style={{ marginTop: 10, padding: '8px 10px', borderRadius: 6, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)' }}>
            <div style={{ fontSize: '0.62rem', fontWeight: 700, color: '#ef4444', marginBottom: 2 }}>Error</div>
            <div style={{ fontSize: '0.66rem', color: '#ef4444' }}>{simResults.error}</div>
          </div>
        )}
      </div>
    </div>
  );

  const canvasContent = (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* ── Toolbar ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px',
        background: isDark ? '#111111' : '#fafafa',
        borderBottom: `1px solid ${border}`,
        flexShrink: 0, flexWrap: 'wrap',
      }}>
        {(['dc', 'transient'] as AnalysisMode[]).map(a => (
          <button key={a} onClick={() => setAnalysis(a)} style={pillBtn(analysis === a)}>
            {a === 'dc' ? 'DC' : 'Transient'}
          </button>
        ))}
        <div style={{ width: 1, height: 18, background: border, margin: '0 2px' }} />
        <button onClick={() => { setMode(mode === 'wire' ? 'select' : 'wire'); setWireStart(null); }}
          style={pillBtn(mode === 'wire', '#3b82f6')}>
          W Wire
        </button>
        {analysis === 'transient' && (
          <button onClick={runTransient} style={{
            padding: '4px 16px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 700,
            cursor: 'pointer', border: '1px solid #3b82f6', background: '#3b82f6', color: '#fff',
            boxShadow: '0 0 12px rgba(59,130,246,0.35)', letterSpacing: 0.3,
          }}>
            ▶ Run
          </button>
        )}
        <button onClick={undo} disabled={history.length === 0} style={{ ...ghostBtn, opacity: history.length === 0 ? 0.4 : 1 }}>↩ Undo</button>
        <button onClick={() => { setComponents([]); setWires([]); setSimResults(null); setProbes([]); labelCounters.current = {}; }} style={ghostBtn}>Clear</button>
        <div style={{ marginLeft: 'auto', fontSize: '0.66rem', color: textDim, letterSpacing: 0.2 }}>
          E=rotate · Del=delete · W=wire · Scroll=zoom · Space+drag=pan
        </div>
      </div>

      {/* ── Canvas + Oscilloscope overlay ── */}
      <div style={{ flex: 1, position: 'relative' }}>
        {/* Circuit canvas */}
        <div ref={containerRef}
          style={{ position: 'absolute', inset: 0, cursor: cursorStyle }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onWheel={handleWheel}
        >
          <canvas ref={canvasRef} style={{ display: 'block', position: 'absolute', inset: 0 }} />
        </div>

        {/* Oscilloscope hover button + popup */}
        {analysis === 'transient' && (
          <div
            style={{ position: 'absolute', top: 12, right: 12, zIndex: 20, display: 'flex', flexDirection: 'column' }}
            onMouseEnter={() => setShowOsc(true)}
            onMouseLeave={() => setShowOsc(false)}
          >
            {/* Small pill */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 7, padding: '5px 14px',
              background: showOsc ? 'rgba(0,255,136,0.07)' : 'rgba(5,5,8,0.82)',
              backdropFilter: 'blur(8px)',
              border: `1px solid ${showOsc ? '#00ff88' : 'rgba(255,255,255,0.08)'}`,
              borderRadius: showOsc ? '8px 8px 0 0' : 8,
              borderBottom: showOsc ? '1px solid #050f0a' : undefined,
              color: showOsc ? '#00ff88' : '#71717a',
              fontSize: '0.68rem', fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase',
              cursor: 'default', userSelect: 'none', fontFamily: 'monospace',
            }}>
              <span style={{
                width: 7, height: 7, borderRadius: '50%', flexShrink: 0, display: 'inline-block',
                background: showOsc ? '#00ff88' : '#3f3f46',
                boxShadow: showOsc ? '0 0 6px #00ff88' : 'none',
                transition: 'all 0.2s',
              }} />
              Oscilloscope
            </div>

            {/* Expanded card */}
            {showOsc && (
              <div style={{
                position: 'absolute', top: '100%', right: 0,
                width: 'min(700px, calc(100vw - 320px))',
                height: 330,
                background: '#050f0a',
                border: '1px solid #0a3320',
                borderTop: 'none',
                borderRadius: '0 0 10px 10px',
                boxShadow: '0 20px 60px rgba(0,255,136,0.08), 0 6px 24px rgba(0,0,0,0.7)',
                display: 'flex', flexDirection: 'column',
                overflow: 'hidden',
              }}>
                {/* Osc toolbar */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px',
                  borderBottom: '1px solid #0a1f14', flexShrink: 0,
                  background: '#030a06',
                }}>
                  <span style={{ color: '#00ff88', fontSize: '0.58rem', fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', fontFamily: 'monospace' }}>
                    ⬤ OSCILLOSCOPE
                  </span>
                  <button onClick={addProbe} style={oscHeaderBtn}>+ Probe</button>
                  <label style={{ fontSize: '0.6rem', color: '#4ade80', display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'monospace' }}>
                    t_max:
                    <input type="number" value={tMax * 1000} min={0.1} max={1000} step={0.1}
                      onChange={e => setTMax(parseFloat(e.target.value) / 1000)}
                      style={{
                        width: 52, padding: '1px 5px', borderRadius: 4, fontSize: '0.6rem',
                        border: '1px solid #0a3320', background: '#030a06', color: '#4ade80',
                        fontFamily: 'monospace',
                      }} />
                    ms
                  </label>
                  <button onClick={() => setProbes([])} style={oscHeaderBtn}>Clear</button>
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                    {probes.map(p => (
                      <span key={p.nodeKey} style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4, padding: '1px 7px',
                        borderRadius: 10, border: `1px solid ${p.color}40`, background: `${p.color}15`,
                        fontSize: '0.58rem', fontFamily: 'monospace', color: p.color,
                      }}>
                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: p.color, display: 'inline-block' }} />
                        {p.nodeKey}
                      </span>
                    ))}
                  </div>
                </div>
                {/* Osc canvas */}
                <div style={{ flex: 1, position: 'relative' }}>
                  <canvas ref={oscRef} style={{ display: 'block', position: 'absolute', inset: 0 }} />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <ToolLayoutSplit defaultRatio={0.22}>
      {[sidebarContent, canvasContent]}
    </ToolLayoutSplit>
  );
}
