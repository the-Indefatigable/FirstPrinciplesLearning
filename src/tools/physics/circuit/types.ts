export type ComponentKind =
  | 'resistor' | 'capacitor' | 'inductor'
  | 'vsource' | 'isource' | 'acsource'
  | 'diode' | 'led' | 'zener'
  | 'npn' | 'pnp' | 'nmos' | 'pmos'
  | 'opamp' | 'switch'
  | 'ground' | 'vcc' | 'junction';

export interface SchComponent {
  id: string;
  kind: ComponentKind;
  gx: number;       // grid col of center
  gy: number;       // grid row of center
  rotation: number; // 0 | 90 | 180 | 270
  value: number;    // R(Ω), C(F), L(H), V(V), I(A)
  value2?: number;  // AC: frequency (Hz)
  value3?: number;  // AC: phase (deg) | BJT: beta | MOSFET: Vth
  label: string;    // "R1", "C2" …
  selected: boolean;
  closed?: boolean; // for switch
}

export interface Wire {
  id: string;
  x1: number; y1: number; // grid coords (horizontal or vertical only)
  x2: number; y2: number;
}

/** Pin position in world grid coords */
export interface PinPos {
  gx: number;
  gy: number;
  label: string; // '+', '−', 'A', 'K', 'B', 'C', 'E', 'G', 'D', 'S', 'IN+', 'IN-', 'OUT'
}

export interface SimResults {
  ok: boolean;
  error?: string;
  nodeVoltages: Record<string, number>;   // nodeKey → V
  branchCurrents: Record<string, number>; // compId  → A (into + terminal)
  power: Record<string, number>;          // compId  → W
  // transient
  time?: number[];
  waveforms?: Record<string, number[]>;   // nodeKey → V[]
}

export interface Probe {
  nodeKey: string;
  color: string;
  label: string;
}

export interface Viewport {
  scale: number;
  tx: number; // pixel offset
  ty: number;
}

export type EditorMode = 'select' | 'place' | 'wire';
export type AnalysisMode = 'dc' | 'transient';
