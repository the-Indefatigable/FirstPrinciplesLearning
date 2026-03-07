import { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import type { SchComponent, Wire, SimResults, Probe, Viewport, EditorMode, AnalysisMode, ComponentKind } from './circuit/types';
import { getPins, solveDC, solveTransient, detectNodes, formatVal } from './circuit/solver';

// ─── Constants ────────────────────────────────────────────────────────────────
const GRID = 20; // px per grid unit

// ─── Default circuit: RC Low-Pass Filter ─────────────────────────────────────
// AC source (5V, 1kHz) → R1(1kΩ) → Node A → C1(10µF) → GND
// Students can observe: input vs filtered output on the oscilloscope.
// Pin layout (rot=0): acsource neg=gx-2, pos=gx+2; resistor pin0=gx-2, pin1=gx+2
// Capacitor (rot=90): rotateOffset(-2,0,90)=[0,2] → pin0 at (gx,gy+2); pin1 at (gx,gy-2)
const DEFAULT_COMPS: SchComponent[] = [
  { id: 'v1', kind: 'acsource', gx: 6,  gy: 9,  rotation: 0,  value: 5,     value2: 1000, label: 'V1',  selected: false },
  { id: 'r1', kind: 'resistor', gx: 14, gy: 9,  rotation: 0,  value: 1000,  label: 'R1',  selected: false },
  { id: 'c1', kind: 'capacitor', gx: 20, gy: 11, rotation: 90, value: 10e-6, label: 'C1',  selected: false },
  { id: 'j1', kind: 'junction', gx: 20, gy: 9,  rotation: 0,  value: 0,     label: 'J',   selected: false },
  { id: 'g1', kind: 'ground',   gx: 4,  gy: 13, rotation: 0,  value: 0,     label: 'GND', selected: false },
  { id: 'g2', kind: 'ground',   gx: 20, gy: 13, rotation: 0,  value: 0,     label: 'GND', selected: false },
];
const DEFAULT_WIRES: Wire[] = [
  { id: 'w1', x1: 8,  y1: 9,  x2: 12, y2: 9  }, // V1+ (8,9) → R1 pin0 (12,9)
  { id: 'w2', x1: 16, y1: 9,  x2: 20, y2: 9  }, // R1 pin1 (16,9) → Node A / C1 top (20,9)
  { id: 'w3', x1: 4,  y1: 9,  x2: 4,  y2: 13 }, // V1− (4,9) → GND1 (4,13)
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
  const [tMax, setTMax] = useState(0.003); // 3 ms — 3 full cycles of the 1 kHz default
  const [dt] = useState(1e-5);
  const [isDark, setIsDark] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [history, setHistory] = useState<{ components: SchComponent[]; wires: Wire[] }[]>([]);
  const [spaceDown, setSpaceDown] = useState(false);
  const panRef = useRef<{ startX: number; startY: number; tx: number; ty: number } | null>(null);
  // Pre-seed counters to match the default circuit labels (V1, R1, C1, J1, GND×2)
  const labelCounters = useRef<Record<string, number>>({ V: 1, R: 1, C: 1, J: 1, GND: 2 });

  // Track dark mode
  useEffect(() => {
    const el = document.documentElement;
    setIsDark(el.getAttribute('data-theme') === 'dark');
    const obs = new MutationObserver(() => setIsDark(el.getAttribute('data-theme') === 'dark'));
    obs.observe(el, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);

  // On mount: auto-run transient on the default circuit and add probes so
  // the oscilloscope shows real waveforms immediately.
  useEffect(() => {
    const dc = solveDC(DEFAULT_COMPS, DEFAULT_WIRES);
    if (!dc.ok) return;
    const nodeKeys = Object.keys(dc.nodeVoltages)
      .filter(nk => nk !== 'GND')
      .slice(0, 4);
    if (nodeKeys.length === 0) return;
    const initProbes: Probe[] = nodeKeys.map((nk, i) => ({
      nodeKey: nk,
      color: PROBE_COLORS[i % PROBE_COLORS.length],
      label: nk,
    }));
    setProbes(initProbes);
    const r = solveTransient(DEFAULT_COMPS, DEFAULT_WIRES, 0.003, 1e-5, nodeKeys);
    setSimResults(r);
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
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
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
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
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
    if (e.ctrlKey || e.metaKey) {
      // Ctrl/Cmd + scroll → zoom (centred on cursor)
      const { sx, sy } = getCanvasPos(e as unknown as React.MouseEvent);
      const delta = e.deltaY > 0 ? 0.95 : 1.05;
      setViewport(v => {
        const newScale = Math.max(0.2, Math.min(5, v.scale * delta));
        const ratio = newScale / v.scale;
        return {
          scale: newScale,
          tx: sx - ratio * (sx - v.tx),
          ty: sy - ratio * (sy - v.ty),
        };
      });
    } else {
      // Plain scroll → pan
      setViewport(v => ({
        ...v,
        tx: v.tx - e.deltaX,
        ty: v.ty - e.deltaY,
      }));
    }
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
      if ((e.key === 'r' || e.key === 'R') && selectedId && !(e.target as HTMLElement).matches('input')) {
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

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: 'calc(100vh - 200px)', minHeight: 580,
      background: isDark ? '#0f0e0c' : '#faf8f5',
      borderRadius: 12, overflow: 'hidden',
      border: `1px solid ${isDark ? '#2a2520' : '#e8e0d4'}`,
      boxShadow: isDark ? '0 4px 32px rgba(0,0,0,0.4)' : '0 4px 32px rgba(26,22,18,0.08)',
      fontFamily: 'Sora, sans-serif',
    }}>
      {/* ── Top bar ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
        background: isDark ? '#1a1612' : '#ffffff',
        borderBottom: `1px solid ${isDark ? '#2a2520' : '#e8e0d4'}`,
        flexShrink: 0, flexWrap: 'wrap',
      }}>
        <span style={{ fontWeight: 700, fontSize: '0.9rem', color: isDark ? '#d4cec6' : '#1a1612', marginRight: 8 }}>
          Circuit Builder
        </span>

        {/* Analysis tabs */}
        {(['dc', 'transient'] as AnalysisMode[]).map(a => (
          <button key={a} onClick={() => setAnalysis(a)}
            style={{
              padding: '4px 12px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 600,
              cursor: 'pointer', border: `1px solid ${analysis === a ? '#d97706' : isDark ? '#3d3530' : '#e8e0d4'}`,
              background: analysis === a ? '#d97706' : 'transparent',
              color: analysis === a ? '#fff' : isDark ? '#9c9488' : '#5c544a',
            }}>
            {a === 'dc' ? 'DC' : 'Transient'}
          </button>
        ))}

        <div style={{ width: 1, height: 20, background: isDark ? '#3d3530' : '#e8e0d4', margin: '0 4px' }} />

        {/* Wire mode */}
        <button onClick={() => { setMode(mode === 'wire' ? 'select' : 'wire'); setWireStart(null); }}
          style={{
            padding: '4px 12px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 600,
            cursor: 'pointer', border: `1px solid ${mode === 'wire' ? '#3b82f6' : isDark ? '#3d3530' : '#e8e0d4'}`,
            background: mode === 'wire' ? '#3b82f620' : 'transparent',
            color: mode === 'wire' ? '#3b82f6' : isDark ? '#9c9488' : '#5c544a',
          }}>
          W Wire
        </button>

        {analysis === 'transient' && (
          <button onClick={runTransient}
            style={{
              padding: '4px 14px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 700,
              cursor: 'pointer', border: '1px solid #d97706',
              background: '#d97706', color: '#fff',
            }}>
            ▶ Run
          </button>
        )}

        <button onClick={undo} disabled={history.length === 0}
          style={{
            padding: '4px 10px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 600,
            cursor: 'pointer', border: `1px solid ${isDark ? '#3d3530' : '#e8e0d4'}`,
            background: 'transparent', color: isDark ? '#9c9488' : '#5c544a',
            opacity: history.length === 0 ? 0.4 : 1,
          }}>
          ↩ Undo
        </button>

        <button onClick={() => { setComponents([]); setWires([]); setSimResults(null); setProbes([]); labelCounters.current = {}; }}
          style={{
            padding: '4px 10px', borderRadius: 6, fontSize: '0.75rem',
            cursor: 'pointer', border: `1px solid ${isDark ? '#3d3530' : '#e8e0d4'}`,
            background: 'transparent', color: isDark ? '#6b6560' : '#9c9488',
          }}>
          Clear
        </button>

        <div style={{ marginLeft: 'auto', fontSize: '0.7rem', color: isDark ? '#6b6560' : '#9c9488' }}>
          R=rotate · Del=delete · W=wire · Space+drag=pan · Scroll=pan · Ctrl+Scroll=zoom
        </div>
      </div>

      {/* ── Middle: palette | canvas | properties ── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* Palette sidebar */}
        <div style={{
          width: 130, flexShrink: 0, overflowY: 'auto',
          background: isDark ? '#130f0d' : '#f3efe8',
          borderRight: `1px solid ${isDark ? '#2a2520' : '#e8e0d4'}`,
          padding: '8px 6px',
        }}>
          {PALETTE.map(group => (
            <div key={group.group}>
              <div style={{ fontSize: '0.62rem', fontWeight: 700, color: isDark ? '#6b6560' : '#9c9488', textTransform: 'uppercase', letterSpacing: 1, padding: '6px 4px 3px' }}>
                {group.group}
              </div>
              {group.items.map(item => (
                <button key={item.kind}
                  onClick={() => {
                    if (placing === item.kind && mode === 'place') { setMode('select'); setPlacing(null); setPlacingDef(null); }
                    else { setMode('place'); setPlacing(item.kind); setPlacingDef(item); }
                  }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    width: '100%', padding: '5px 6px', marginBottom: 2,
                    borderRadius: 6, fontSize: '0.72rem', fontWeight: 500,
                    cursor: 'pointer', textAlign: 'left',
                    border: `1px solid ${placing === item.kind && mode === 'place' ? '#d97706' : 'transparent'}`,
                    background: placing === item.kind && mode === 'place'
                      ? (isDark ? '#2a1f0a' : '#fef3c7')
                      : 'transparent',
                    color: placing === item.kind && mode === 'place'
                      ? '#d97706'
                      : (isDark ? '#d4cec6' : '#1a1612'),
                  }}>
                  <span style={{
                    width: 22, height: 22, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: isDark ? '#1e1c18' : '#e8e0d4', fontSize: '0.62rem', fontWeight: 700, flexShrink: 0,
                  }}>
                    {item.key}
                  </span>
                  {item.label}
                </button>
              ))}
            </div>
          ))}
        </div>

        {/* Canvas */}
        <div ref={containerRef} style={{ flex: 1, position: 'relative', overflow: 'hidden', cursor: cursorStyle }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onWheel={handleWheel}
        >
          <canvas ref={canvasRef} style={{ display: 'block', position: 'absolute', inset: 0 }} />
        </div>

        {/* Properties sidebar */}
        <div style={{
          width: 190, flexShrink: 0, overflowY: 'auto',
          background: isDark ? '#130f0d' : '#f3efe8',
          borderLeft: `1px solid ${isDark ? '#2a2520' : '#e8e0d4'}`,
          padding: '10px 10px',
        }}>
          {selectedComp ? (
            <>
              <div style={{ fontWeight: 700, fontSize: '0.8rem', color: isDark ? '#d4cec6' : '#1a1612', marginBottom: 8 }}>
                {selectedComp.label} — {selectedComp.kind}
              </div>

              {/* Value editor */}
              {editingId === selectedComp.id ? (
                <div style={{ marginBottom: 8 }}>
                  <input
                    autoFocus
                    value={editValue}
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
                      width: '100%', padding: '4px 6px', borderRadius: 5, fontSize: '0.8rem',
                      border: `1px solid #d97706`, background: isDark ? '#1a1612' : '#fff',
                      color: isDark ? '#d4cec6' : '#1a1612',
                    }}
                  />
                  <div style={{ fontSize: '0.65rem', color: isDark ? '#6b6560' : '#9c9488', marginTop: 2 }}>Enter to confirm</div>
                </div>
              ) : (
                <button onClick={() => { setEditingId(selectedComp.id); setEditValue(String(selectedComp.value)); }}
                  style={{
                    width: '100%', padding: '5px 8px', borderRadius: 6, fontSize: '0.78rem', fontWeight: 600,
                    cursor: 'pointer', textAlign: 'left', marginBottom: 8,
                    border: `1px solid ${isDark ? '#3d3530' : '#e8e0d4'}`,
                    background: isDark ? '#1a1612' : '#fff',
                    color: isDark ? '#d4cec6' : '#1a1612',
                  }}>
                  {formatVal(selectedComp.value, unitSuffix(selectedComp.kind))}
                  <span style={{ float: 'right', color: isDark ? '#6b6560' : '#9c9488', fontWeight: 400 }}>edit</span>
                </button>
              )}

              {/* Rotate / delete */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                <button onClick={() => setComponents(prev => prev.map(c => c.id === selectedComp.id ? { ...c, rotation: (c.rotation + 90) % 360 } : c))}
                  style={{ flex: 1, padding: '4px', borderRadius: 5, fontSize: '0.72rem', cursor: 'pointer', border: `1px solid ${isDark ? '#3d3530' : '#e8e0d4'}`, background: 'transparent', color: isDark ? '#d4cec6' : '#1a1612' }}>
                  ↻ Rotate
                </button>
                <button onClick={() => {
                  pushHistory();
                  setComponents(prev => prev.filter(c => c.id !== selectedComp.id));
                  setSelectedId(null);
                }}
                  style={{ flex: 1, padding: '4px', borderRadius: 5, fontSize: '0.72rem', cursor: 'pointer', border: '1px solid #ef444460', background: 'transparent', color: '#ef4444' }}>
                  ✕ Del
                </button>
              </div>

              {/* Switch toggle */}
              {selectedComp.kind === 'switch' && (
                <button onClick={() => setComponents(prev => prev.map(c => c.id === selectedComp.id ? { ...c, closed: !c.closed } : c))}
                  style={{
                    width: '100%', padding: '5px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', marginBottom: 8,
                    border: `1px solid ${selectedComp.closed ? '#10b981' : '#ef4444'}`,
                    background: selectedComp.closed ? '#10b98120' : '#ef444420',
                    color: selectedComp.closed ? '#10b981' : '#ef4444',
                  }}>
                  {selectedComp.closed ? '⬤ Closed' : '○ Open'}
                </button>
              )}

              {/* Sim results for this component */}
              {simResults?.ok && (
                <div style={{ marginTop: 4 }}>
                  <div style={{ fontSize: '0.65rem', fontWeight: 700, color: isDark ? '#6b6560' : '#9c9488', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Results</div>
                  {simResults.branchCurrents[selectedComp.id] !== undefined && (
                    <div style={{ fontSize: '0.75rem', color: '#3b82f6', marginBottom: 2 }}>
                      I = {formatVal(simResults.branchCurrents[selectedComp.id], 'A')}
                    </div>
                  )}
                  {simResults.power[selectedComp.id] !== undefined && (
                    <div style={{ fontSize: '0.75rem', color: '#f59e0b', marginBottom: 2 }}>
                      P = {formatVal(simResults.power[selectedComp.id], 'W')}
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <div style={{ fontSize: '0.75rem', color: isDark ? '#6b6560' : '#9c9488', textAlign: 'center', marginTop: 24 }}>
              Click a component to select it
            </div>
          )}

          {/* Node voltage table */}
          {simResults?.ok && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: '0.65rem', fontWeight: 700, color: isDark ? '#6b6560' : '#9c9488', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
                Node Voltages
              </div>
              {Object.entries(simResults.nodeVoltages)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([nk, v]) => (
                  <div key={nk} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '3px 0', borderBottom: `1px solid ${isDark ? '#1e1c18' : '#e8e0d4'}`,
                  }}>
                    <span style={{ fontSize: '0.72rem', fontFamily: 'monospace', color: isDark ? '#d4cec6' : '#1a1612' }}>{nk}</span>
                    <span style={{ fontSize: '0.72rem', fontFamily: 'monospace', color: voltageColor(v, Math.max(...Object.values(simResults.nodeVoltages).map(Math.abs), 0.001)) }}>
                      {formatVal(v, 'V')}
                    </span>
                  </div>
                ))}

              {/* Probe buttons */}
              {analysis === 'transient' && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: '0.65rem', fontWeight: 700, color: isDark ? '#6b6560' : '#9c9488', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Probes</div>
                  {Object.keys(simResults.nodeVoltages).filter(nk => nk !== 'GND').map(nk => {
                    const existing = probes.find(p => p.nodeKey === nk);
                    return (
                      <button key={nk} onClick={() => {
                        if (existing) setProbes(prev => prev.filter(p => p.nodeKey !== nk));
                        else {
                          const color = PROBE_COLORS[probes.length % PROBE_COLORS.length];
                          setProbes(prev => [...prev, { nodeKey: nk, color, label: nk }]);
                        }
                      }}
                        style={{
                          display: 'block', width: '100%', padding: '3px 6px', marginBottom: 2, borderRadius: 4, fontSize: '0.7rem',
                          cursor: 'pointer', textAlign: 'left',
                          border: `1px solid ${existing ? existing.color : isDark ? '#3d3530' : '#e8e0d4'}`,
                          background: existing ? `${existing.color}20` : 'transparent',
                          color: existing ? existing.color : isDark ? '#9c9488' : '#5c544a',
                        }}>
                        {existing ? '⬤' : '○'} {nk}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {simResults && !simResults.ok && (
            <div style={{ marginTop: 12, padding: '8px', borderRadius: 6, background: '#ef444415', border: '1px solid #ef444440' }}>
              <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#ef4444', marginBottom: 3 }}>Error</div>
              <div style={{ fontSize: '0.68rem', color: '#ef4444' }}>{simResults.error}</div>
            </div>
          )}
        </div>
      </div>

      {/* ── Oscilloscope panel ── */}
      {analysis === 'transient' && (
        <div style={{
          height: 180, flexShrink: 0,
          borderTop: `1px solid ${isDark ? '#2a2520' : '#e8e0d4'}`,
          background: isDark ? '#0a0908' : '#f3efe8',
          display: 'flex', flexDirection: 'column',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '4px 10px',
            borderBottom: `1px solid ${isDark ? '#1e1c18' : '#e8e0d4'}`, flexShrink: 0,
          }}>
            <span style={{ fontSize: '0.68rem', fontWeight: 700, color: isDark ? '#6b6560' : '#9c9488', textTransform: 'uppercase', letterSpacing: 1 }}>
              Oscilloscope
            </span>
            <button onClick={addProbe} style={{ padding: '2px 8px', borderRadius: 4, fontSize: '0.68rem', cursor: 'pointer', border: `1px solid ${isDark ? '#3d3530' : '#e8e0d4'}`, background: 'transparent', color: isDark ? '#9c9488' : '#5c544a' }}>
              + Probe
            </button>
            <label style={{ fontSize: '0.68rem', color: isDark ? '#6b6560' : '#9c9488' }}>
              t_max:
              <input type="number" value={tMax * 1000} min={0.1} max={1000} step={0.1}
                onChange={e => setTMax(parseFloat(e.target.value) / 1000)}
                style={{ width: 55, marginLeft: 4, padding: '1px 4px', borderRadius: 4, fontSize: '0.68rem', border: `1px solid ${isDark ? '#3d3530' : '#e8e0d4'}`, background: isDark ? '#1a1612' : '#fff', color: isDark ? '#d4cec6' : '#1a1612' }} />
              ms
            </label>
            <button onClick={() => setProbes([])} style={{ padding: '2px 8px', borderRadius: 4, fontSize: '0.68rem', cursor: 'pointer', border: `1px solid ${isDark ? '#3d3530' : '#e8e0d4'}`, background: 'transparent', color: isDark ? '#9c9488' : '#5c544a' }}>
              Clear
            </button>
          </div>
          <div style={{ flex: 1, position: 'relative' }}>
            <canvas ref={oscRef} style={{ display: 'block', position: 'absolute', inset: 0 }} />
          </div>
        </div>
      )}
    </div>
  );
}
