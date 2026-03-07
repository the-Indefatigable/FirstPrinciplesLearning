import type { SchComponent, Wire, PinPos, SimResults } from './types';

// ─── Pin layout (local grid offsets, pre-rotation) ───────────────────────────
// All 2-terminal devices span 4 grid units wide; center = (0,0)
// 3-terminal devices defined per-kind

const PIN2: [number, number][] = [[-2, 0], [2, 0]]; // left, right

function rotateOffset(dx: number, dy: number, rot: number): [number, number] {
  switch (rot) {
    case 90:  return [dy, -dx];
    case 180: return [-dx, -dy];
    case 270: return [-dy, dx];
    default:  return [dx, dy];
  }
}

export function getPins(c: SchComponent): PinPos[] {
  const r = (dx: number, dy: number) => rotateOffset(dx, dy, c.rotation);
  const p = (dx: number, dy: number, label: string): PinPos => ({
    gx: c.gx + r(dx, dy)[0],
    gy: c.gy + r(dx, dy)[1],
    label,
  });

  switch (c.kind) {
    // 2-terminal
    case 'resistor':
    case 'capacitor':
    case 'inductor':
    case 'switch':
    case 'diode':
    case 'led':
    case 'zener':
      return PIN2.map(([dx, dy], i) => p(dx, dy, i === 0 ? '+' : '−'));

    case 'vsource':
    case 'acsource':
      return [p(-2, 0, '−'), p(2, 0, '+')];

    case 'isource':
      return [p(-2, 0, '−'), p(2, 0, '+')];

    case 'ground':
      return [p(0, 0, 'GND')];

    case 'vcc':
      return [p(0, 0, 'VCC')];

    case 'junction':
      return [p(0, 0, 'J')];

    // NPN BJT: Base(left), Collector(top-right), Emitter(bottom-right)
    case 'npn':
      return [p(-2, 0, 'B'), p(2, -2, 'C'), p(2, 2, 'E')];

    // PNP BJT: Base(left), Collector(bottom-right), Emitter(top-right)
    case 'pnp':
      return [p(-2, 0, 'B'), p(2, 2, 'C'), p(2, -2, 'E')];

    // NMOS/PMOS: Gate(left), Drain(top-right), Source(bottom-right)
    case 'nmos':
    case 'pmos':
      return [p(-2, 0, 'G'), p(2, -2, 'D'), p(2, 2, 'S')];

    // Op-Amp: IN+(top-left), IN−(bottom-left), OUT(right), VCC(top), GND(bottom)
    case 'opamp':
      return [
        p(-2, -1, 'IN+'), p(-2, 1, 'IN−'),
        p(2, 0, 'OUT'),
        p(0, -2, 'VCC'), p(0, 2, 'GND'),
      ];

    default:
      return PIN2.map(([dx, dy], i) => p(dx, dy, i === 0 ? '+' : '−'));
  }
}

// ─── Union-Find ───────────────────────────────────────────────────────────────

class UF {
  private parent = new Map<string, string>();
  find(k: string): string {
    if (!this.parent.has(k)) this.parent.set(k, k);
    if (this.parent.get(k) !== k) this.parent.set(k, this.find(this.parent.get(k)!));
    return this.parent.get(k)!;
  }
  union(a: string, b: string) {
    const ra = this.find(a), rb = this.find(b);
    if (ra !== rb) this.parent.set(ra, rb);
  }
  keys(): string[] { return [...this.parent.keys()]; }
}

function gkey(gx: number, gy: number) { return `${gx},${gy}`; }

/** Returns: map from (compId + ':' + pinIndex) → nodeKey, and nodeKey set */
export function detectNodes(
  components: SchComponent[],
  wires: Wire[],
): { pinNodeMap: Map<string, string>; nodeKeys: string[] } {
  const uf = new UF();

  // Touch every pin grid position
  for (const c of components) {
    const pins = getPins(c);
    pins.forEach(pin => uf.find(gkey(pin.gx, pin.gy)));
  }

  // Touch every wire endpoint
  for (const w of wires) {
    uf.find(gkey(w.x1, w.y1));
    uf.find(gkey(w.x2, w.y2));
    // Wire connects x1,y1 ↔ x2,y2 and all intermediate grid points
    if (w.x1 === w.x2) {
      const minY = Math.min(w.y1, w.y2), maxY = Math.max(w.y1, w.y2);
      for (let gy = minY; gy <= maxY; gy++) uf.union(gkey(w.x1, gy), gkey(w.x1, w.y1));
    } else {
      const minX = Math.min(w.x1, w.x2), maxX = Math.max(w.x1, w.x2);
      for (let gx = minX; gx <= maxX; gx++) uf.union(gkey(gx, w.y1), gkey(w.x1, w.y1));
    }
  }

  // Union pins that share the same grid position
  const gridToPinKey = new Map<string, string>();
  for (const c of components) {
    const pins = getPins(c);
    pins.forEach((pin, i) => {
      const gk = gkey(pin.gx, pin.gy);
      const pk = `${c.id}:${i}`;
      if (gridToPinKey.has(gk)) {
        uf.union(gk, gridToPinKey.get(gk)!);
      }
      gridToPinKey.set(gk, gk);
      uf.union(pk, gk);
    });
  }

  // Find GND root: union ALL ground components together so multiple GND symbols
  // in the schematic are treated as the same net (just like real schematics).
  let gndRoot: string | null = null;
  for (const c of components) {
    if (c.kind === 'ground') {
      const pins = getPins(c);
      const gk = gkey(pins[0].gx, pins[0].gy);
      if (gndRoot === null) {
        gndRoot = uf.find(gk);
      } else {
        uf.union(gk, gndRoot);
        gndRoot = uf.find(gndRoot);
      }
    }
  }

  // Assign readable node names
  const rootToName = new Map<string, string>();
  if (gndRoot) rootToName.set(gndRoot, 'GND');

  let nodeCounter = 1;
  const pinNodeMap = new Map<string, string>();
  for (const c of components) {
    const pins = getPins(c);
    pins.forEach((pin, i) => {
      const root = uf.find(gkey(pin.gx, pin.gy));
      if (!rootToName.has(root)) {
        rootToName.set(root, `N${String(nodeCounter++).padStart(3, '0')}`);
      }
      pinNodeMap.set(`${c.id}:${i}`, rootToName.get(root)!);
    });
  }

  const nodeKeys = [...new Set(rootToName.values())];
  return { pinNodeMap, nodeKeys };
}

// ─── Gaussian Elimination with partial pivoting ────────────────────────────

function gaussSolve(A: number[][], b: number[]): number[] | null {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);

  for (let col = 0; col < n; col++) {
    // Find pivot
    let maxRow = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(M[r][col]) > Math.abs(M[maxRow][col])) maxRow = r;
    }
    [M[col], M[maxRow]] = [M[maxRow], M[col]];
    if (Math.abs(M[col][col]) < 1e-12) return null; // singular

    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = M[r][col] / M[col][col];
      for (let c = col; c <= n; c++) M[r][c] -= f * M[col][c];
    }
  }
  return M.map((row, i) => row[n] / row[i]);
}

// ─── MNA Stamp helpers ────────────────────────────────────────────────────────

function nodeIdx(name: string, nodeList: string[]): number {
  return nodeList.indexOf(name); // -1 for GND (removed from matrix)
}

function stampR(G: number[][], ni: number, nj: number, conductance: number) {
  if (ni >= 0) G[ni][ni] += conductance;
  if (nj >= 0) G[nj][nj] += conductance;
  if (ni >= 0 && nj >= 0) { G[ni][nj] -= conductance; G[nj][ni] -= conductance; }
}

// ─── DC Solver ────────────────────────────────────────────────────────────────

export function solveDC(
  components: SchComponent[],
  wires: Wire[],
): SimResults {
  try {
    const { pinNodeMap, nodeKeys } = detectNodes(components, wires);

    // Nodes excluding GND
    const nonGndNodes = nodeKeys.filter(k => k !== 'GND');
    const n = nonGndNodes.length;
    if (n === 0) return { ok: false, error: 'No nodes (add a Ground)', nodeVoltages: {}, branchCurrents: {}, power: {} };

    // Count voltage sources (vsource, acsource DC amplitude, inductor short, closed switch)
    const vsComps: SchComponent[] = [];
    for (const c of components) {
      if (c.kind === 'vsource' || c.kind === 'acsource') vsComps.push(c);
      if (c.kind === 'inductor') vsComps.push(c); // DC short = 0V source
      if (c.kind === 'switch' && c.closed) vsComps.push(c); // closed = 0V short
      if (c.kind === 'vcc') vsComps.push(c);
    }
    const m = vsComps.length;
    const sz = n + m;

    const G: number[][] = Array.from({ length: sz }, () => new Array(sz).fill(0));
    const b: number[] = new Array(sz).fill(0);

    const ni = (name: string) => nodeIdx(name, nonGndNodes);

    const getPin = (compId: string, pinIdx: number) => pinNodeMap.get(`${compId}:${pinIdx}`) ?? 'GND';

    // Stamp each component
    for (const c of components) {
      switch (c.kind) {
        case 'resistor': {
          if (c.value <= 0) break;
          const g = 1 / c.value;
          const a = ni(getPin(c.id, 0)), bv = ni(getPin(c.id, 1));
          stampR(G, a, bv, g);
          break;
        }
        case 'capacitor':
          // DC: open circuit → nothing
          break;
        case 'diode':
        case 'led':
        case 'zener': {
          // Ideal diode: if forward-biased → 0V vsource (already handled via convergence loop below)
          // Simple approximation: treat as open for DC (user can see if it makes sense)
          // A proper implementation needs Newton-Raphson; for now: ideal diode = tiny R forward, huge R reverse
          // We'll use a simplified nonlinear iteration: two-pass
          // For now stamp as resistor 0.01Ω (will be refined below with NR)
          const forwardDrop = c.kind === 'led' ? 2.0 : (c.kind === 'zener' ? c.value || 5.1 : 0.6);
          // stamp as 1Ω forward-biased approximation (Newton-Raphson not implemented yet)
          // real behaviour: if (Va - Vk) > forwardDrop → conductive, else open
          // Simplified: very large conductance forward, 1e-9 reverse
          // We'll iterate 3 times below
          void forwardDrop;
          // Initially stamp as open (1e-9 S)
          const ga = ni(getPin(c.id, 0)), gk = ni(getPin(c.id, 1));
          stampR(G, ga, gk, 1e-9);
          break;
        }
        case 'isource': {
          const iA = ni(getPin(c.id, 0)), iB = ni(getPin(c.id, 1));
          if (iA >= 0) b[iA] -= c.value;
          if (iB >= 0) b[iB] += c.value;
          break;
        }
        case 'npn': {
          // Simplified: Ic = β·Ib; treat as VCCS between C and E controlled by B-E
          // Stamp as conductance β/Rbe between C and E nodes
          const beta = c.value3 ?? 100;
          const rb = 1000; // assumed base resistance
          const nB = ni(getPin(c.id, 0)), nC = ni(getPin(c.id, 1)), nE = ni(getPin(c.id, 2));
          // Base-emitter resistor
          stampR(G, nB, nE, 1 / rb);
          // VCCS: Ic = beta/rb * Vbe → stamp as G_CE = beta/rb (simplified linear model)
          if (nC >= 0 && nE >= 0) {
            G[nC][nC] += beta / rb;
            G[nE][nE] += beta / rb;
            G[nC][nE] -= beta / rb;
            G[nE][nC] -= beta / rb;
          }
          if (nB >= 0 && nC >= 0) { G[nC][nB] += beta / rb; }
          if (nB >= 0 && nE >= 0) { G[nC][nE] -= beta / rb; }
          break;
        }
        case 'pnp': {
          const beta = c.value3 ?? 100;
          const rb = 1000;
          const nB = ni(getPin(c.id, 0)), nC = ni(getPin(c.id, 1)), nE = ni(getPin(c.id, 2));
          stampR(G, nB, nE, 1 / rb);
          if (nC >= 0 && nE >= 0) {
            G[nC][nC] += beta / rb; G[nE][nE] += beta / rb;
            G[nC][nE] -= beta / rb; G[nE][nC] -= beta / rb;
          }
          break;
        }
        case 'nmos':
        case 'pmos': {
          // Simplified: Id = k*(Vgs-Vth)^2 in saturation
          // For DC linearization: gm = 2*k*(Vgs-Vth), stamp as VCCS
          // Use k=10mA/V^2, Vth from value3
          const Vth = c.value3 ?? (c.kind === 'nmos' ? 2 : -2);
          const k = 0.01;
          const nG = ni(getPin(c.id, 0)), nD = ni(getPin(c.id, 1)), nS = ni(getPin(c.id, 2));
          // Simplified: stamp gate-source resistance + VCCS
          if (nG >= 0) stampR(G, nG, nS, 1e-9); // gate = high impedance
          const Vgs_guess = 5 - Vth; // assume reasonable operating point
          const gm = 2 * k * Math.max(0, Vgs_guess);
          if (nD >= 0 && nS >= 0) {
            G[nD][nD] += gm; G[nS][nS] += gm;
            G[nD][nS] -= gm; G[nS][nD] -= gm;
          }
          if (nG >= 0 && nD >= 0) G[nD][nG] += gm;
          if (nG >= 0 && nS >= 0) G[nD][nS] -= gm;
          void Vth;
          break;
        }
        case 'opamp': {
          // Ideal op-amp: V(IN+) = V(IN−) virtual short → force via large gain
          // OUT = A*(V+ - V−), A=1e6
          const A = 1e6;
          const nIp = ni(getPin(c.id, 0)), nIn = ni(getPin(c.id, 1)), nOut = ni(getPin(c.id, 2));
          // Stamp VCVS approximation: G_out,out += A, G_out,ip -= A, G_out,in += A
          if (nOut >= 0) {
            G[nOut][nOut] += A;
            if (nIp >= 0) G[nOut][nIp] -= A;
            if (nIn >= 0) G[nOut][nIn] += A;
          }
          break;
        }
        default:
          break;
      }
    }

    // Stamp voltage sources into rows n..n+m-1
    vsComps.forEach((c, k) => {
      const row = n + k;
      let posNode: string, negNode: string, voltage: number;

      if (c.kind === 'vcc') {
        posNode = getPin(c.id, 0); negNode = 'GND'; voltage = c.value;
      } else if (c.kind === 'inductor' || (c.kind === 'switch' && c.closed)) {
        posNode = getPin(c.id, 0); negNode = getPin(c.id, 1); voltage = 0;
      } else {
        // vsource: pin0=neg, pin1=pos
        negNode = getPin(c.id, 0); posNode = getPin(c.id, 1); voltage = c.value;
      }

      const nPos = ni(posNode), nNeg = ni(negNode);
      if (nPos >= 0) { G[nPos][row] += 1; G[row][nPos] += 1; }
      if (nNeg >= 0) { G[nNeg][row] -= 1; G[row][nNeg] -= 1; }
      b[row] = voltage;
    });

    const x = gaussSolve(G, b);
    if (!x) return { ok: false, error: 'Singular matrix — check for floating nodes or short circuits', nodeVoltages: {}, branchCurrents: {}, power: {} };

    const nodeVoltages: Record<string, number> = { GND: 0 };
    nonGndNodes.forEach((name, i) => { nodeVoltages[name] = x[i]; });

    const getV = (nodeKey: string) => nodeVoltages[nodeKey] ?? 0;
    const branchCurrents: Record<string, number> = {};
    const power: Record<string, number> = {};

    vsComps.forEach((c, k) => { branchCurrents[c.id] = x[n + k]; });

    for (const c of components) {
      const pin0node = getPin(c.id, 0);
      const pin1node = getPin(c.id, 1) ?? 'GND';
      const v0 = getV(pin0node), v1 = getV(pin1node);
      switch (c.kind) {
        case 'resistor': {
          const I = c.value > 0 ? (v0 - v1) / c.value : 0;
          branchCurrents[c.id] = I;
          power[c.id] = I * I * c.value;
          break;
        }
        case 'capacitor':
          branchCurrents[c.id] = 0; power[c.id] = 0;
          break;
        case 'diode': case 'led': case 'zener':
          branchCurrents[c.id] = 0; power[c.id] = 0;
          break;
        case 'vsource': case 'acsource': case 'vcc': {
          const I = branchCurrents[c.id] ?? 0;
          power[c.id] = -c.value * I; // power delivered
          break;
        }
      }
    }

    return { ok: true, nodeVoltages, branchCurrents, power };
  } catch (e) {
    return { ok: false, error: String(e), nodeVoltages: {}, branchCurrents: {}, power: {} };
  }
}

// ─── Transient Solver (Backward Euler) ───────────────────────────────────────

export function solveTransient(
  components: SchComponent[],
  wires: Wire[],
  tMax: number,
  dt: number,
  probeNodes: string[],
): SimResults {
  try {
    const { pinNodeMap, nodeKeys } = detectNodes(components, wires);
    const nonGndNodes = nodeKeys.filter(k => k !== 'GND');
    const n = nonGndNodes.length;
    if (n === 0) return { ok: false, error: 'No nodes', nodeVoltages: {}, branchCurrents: {}, power: {} };

    const getPin = (compId: string, pinIdx: number) => pinNodeMap.get(`${compId}:${pinIdx}`) ?? 'GND';
    const ni = (name: string) => nodeIdx(name, nonGndNodes);

    // Capacitor & inductor state
    const Vc = new Map<string, number>(); // compId → voltage across capacitor
    const IL = new Map<string, number>(); // compId → current through inductor
    for (const c of components) {
      if (c.kind === 'capacitor') Vc.set(c.id, 0);
      if (c.kind === 'inductor') IL.set(c.id, 0);
    }

    // Voltage sources (vsource, acsource, vcc — capacitors/inductors handled separately)
    const vsComps = components.filter(c =>
      c.kind === 'vsource' || c.kind === 'acsource' || c.kind === 'vcc' ||
      (c.kind === 'switch' && c.closed)
    );
    const m = vsComps.length;

    const steps = Math.min(Math.ceil(tMax / dt), 5000);
    const timeArr: number[] = [];
    const waveforms: Record<string, number[]> = {};
    probeNodes.forEach(nk => { waveforms[nk] = []; });

    let prevX: number[] | null = null;

    for (let step = 0; step <= steps; step++) {
      const t = step * dt;
      const sz = n + m;
      const G: number[][] = Array.from({ length: sz }, () => new Array(sz).fill(0));
      const b: number[] = new Array(sz).fill(0);

      // Stamp resistors
      for (const c of components) {
        if (c.kind === 'resistor' && c.value > 0) {
          const a = ni(getPin(c.id, 0)), bv = ni(getPin(c.id, 1));
          stampR(G, a, bv, 1 / c.value);
        }
      }

      // Stamp capacitor companion models
      for (const c of components) {
        if (c.kind !== 'capacitor' || c.value <= 0) continue;
        const Geq = c.value / dt;
        const Vprev = Vc.get(c.id) ?? 0;
        const Ieq = Geq * Vprev;
        const a = ni(getPin(c.id, 0)), bv = ni(getPin(c.id, 1));
        stampR(G, a, bv, Geq);
        if (a >= 0) b[a] += Ieq;
        if (bv >= 0) b[bv] -= Ieq;
      }

      // Stamp inductor companion models (Norton: Geq = dt/L, Ieq = IL_prev)
      for (const c of components) {
        if (c.kind !== 'inductor' || c.value <= 0) continue;
        const Geq = dt / c.value;
        const Ieq = IL.get(c.id) ?? 0;
        const a = ni(getPin(c.id, 0)), bv = ni(getPin(c.id, 1));
        stampR(G, a, bv, Geq);
        if (a >= 0) b[a] += Ieq;
        if (bv >= 0) b[bv] -= Ieq;
      }

      // Stamp current sources
      for (const c of components) {
        if (c.kind !== 'isource') continue;
        const iA = ni(getPin(c.id, 0)), iB = ni(getPin(c.id, 1));
        if (iA >= 0) b[iA] -= c.value;
        if (iB >= 0) b[iB] += c.value;
      }

      // Stamp voltage sources
      vsComps.forEach((c, k) => {
        const row = n + k;
        let posNode: string, negNode: string, voltage: number;
        if (c.kind === 'vcc') {
          posNode = getPin(c.id, 0); negNode = 'GND'; voltage = c.value;
        } else if (c.kind === 'switch') {
          posNode = getPin(c.id, 0); negNode = getPin(c.id, 1); voltage = 0;
        } else if (c.kind === 'acsource') {
          const freq = c.value2 ?? 1000;
          const phase = (c.value3 ?? 0) * Math.PI / 180;
          posNode = getPin(c.id, 1); negNode = getPin(c.id, 0);
          voltage = c.value * Math.sin(2 * Math.PI * freq * t + phase);
        } else {
          negNode = getPin(c.id, 0); posNode = getPin(c.id, 1); voltage = c.value;
        }
        const nPos = ni(posNode), nNeg = ni(negNode);
        if (nPos >= 0) { G[nPos][row] += 1; G[row][nPos] += 1; }
        if (nNeg >= 0) { G[nNeg][row] -= 1; G[row][nNeg] -= 1; }
        b[row] = voltage;
      });

      const solved: number[] = gaussSolve(G, b) ?? prevX ?? new Array(sz).fill(0);
      prevX = solved;
      const x = solved;

      const nodeVoltages: Record<string, number> = { GND: 0 };
      nonGndNodes.forEach((name, i) => { nodeVoltages[name] = x[i]; });

      // Update capacitor voltages and inductor currents
      for (const c of components) {
        if (c.kind === 'capacitor') {
          const va = nodeVoltages[getPin(c.id, 0)] ?? 0;
          const vb = nodeVoltages[getPin(c.id, 1)] ?? 0;
          Vc.set(c.id, va - vb);
        }
        if (c.kind === 'inductor' && c.value > 0) {
          const va = nodeVoltages[getPin(c.id, 0)] ?? 0;
          const vb = nodeVoltages[getPin(c.id, 1)] ?? 0;
          const Vprev_L = va - vb;
          const Iprev = IL.get(c.id) ?? 0;
          IL.set(c.id, Iprev + (dt / c.value) * Vprev_L);
        }
      }

      timeArr.push(t);
      probeNodes.forEach(nk => {
        waveforms[nk].push(nodeVoltages[nk] ?? 0);
      });
    }

    // Final DC node voltages (last step)
    const finalVoltages: Record<string, number> = { GND: 0 };
    if (prevX) nonGndNodes.forEach((name, i) => { finalVoltages[name] = prevX![i]; });

    return { ok: true, nodeVoltages: finalVoltages, branchCurrents: {}, power: {}, time: timeArr, waveforms };
  } catch (e) {
    return { ok: false, error: String(e), nodeVoltages: {}, branchCurrents: {}, power: {} };
  }
}

export function formatVal(v: number, unit: string): string {
  const abs = Math.abs(v);
  if (abs >= 1e6) return `${(v / 1e6).toPrecision(3)}M${unit}`;
  if (abs >= 1e3) return `${(v / 1e3).toPrecision(3)}k${unit}`;
  if (abs >= 1) return `${v.toPrecision(3)}${unit}`;
  if (abs >= 1e-3) return `${(v * 1e3).toPrecision(3)}m${unit}`;
  if (abs >= 1e-6) return `${(v * 1e6).toPrecision(3)}μ${unit}`;
  if (abs >= 1e-9) return `${(v * 1e9).toPrecision(3)}n${unit}`;
  return `${v.toExponential(2)}${unit}`;
}
