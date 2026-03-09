/**
 * Shared color palette for Immersive Mode — matches manimCanvas.ts MANIM colors
 * but as Three.js-compatible hex values and HDR multipliers for bloom.
 */

import * as THREE from 'three';

export const IMM = {
  bg: new THREE.Color('#0f1117'),
  bgGradientCenter: new THREE.Color('#141822'),
  grid: new THREE.Color('#58C4DD'),
  gridAlpha: 0.07,
  axis: new THREE.Color('#c8d2e1'),
  axisAlpha: 0.35,

  // Curve colors — same order as MANIM.palette
  palette: [
    '#58C4DD', // blue
    '#F4D03F', // yellow
    '#83C167', // green
    '#FC6255', // pink
    '#5CD0B3', // teal
    '#B07CD8', // purple
    '#FF8C42', // orange
  ],

  white: '#ECF0F1',

  // HDR bloom multiplier — curves emit more light than 1.0
  bloomEmissive: 2.5,
  bloomStrength: 1.4,
  bloomThreshold: 0.3,
  bloomRadius: 0.6,
} as const;
