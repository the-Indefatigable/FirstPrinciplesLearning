/**
 * Immersive Mode — WebGL2 rendering pipeline with real GPU bloom.
 *
 * All exports are lazy-loadable. Nothing in this module is imported
 * unless the user activates Immersive Mode.
 */

export { IMM } from './palette';
export { ImmersiveRenderer, type ImmersiveRendererOptions } from './ImmersiveRenderer';
export { createGlowLine, updateGlowLine, type GlowLineOptions } from './glowLine';
export {
  createBackground, updateBackground,
  createGridLines,
  createAxes,
  createCrosshair, updateCrosshair,
  createGlowDot, positionDot,
} from './sceneObjects';
