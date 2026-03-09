/**
 * ImmersiveRenderer.ts — WebGL2 rendering pipeline with real GPU bloom.
 *
 * Architecture:
 *   Scene → HDR RenderTarget → Luminance Threshold → Gaussian Blur → Composite
 *   + Vignette post-pass + subtle film grain
 *
 * This renderer is designed to be lazily initialized and shared across tools.
 */

import * as THREE from 'three';
import {
  EffectComposer, RenderPass, EffectPass,
  BloomEffect, VignetteEffect, NoiseEffect,
  BlendFunction, KernelSize,
} from 'postprocessing';
import { IMM } from './palette';

export interface ImmersiveRendererOptions {
  container: HTMLElement;
  bloomStrength?: number;
  bloomThreshold?: number;
  bloomRadius?: number;
}

export class ImmersiveRenderer {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly camera: THREE.OrthographicCamera;
  readonly composer: EffectComposer;
  readonly bloomEffect: BloomEffect;

  private _width = 0;
  private _height = 0;
  private _animationId = 0;
  private _renderCallback: (() => void) | null = null;
  private _disposed = false;
  private _container: HTMLElement;
  private _resizeObserver: ResizeObserver;

  constructor(opts: ImmersiveRendererOptions) {
    this._container = opts.container;

    // WebGL2 renderer with HDR support
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.setClearColor(IMM.bg, 1);

    this._container.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.cursor = 'crosshair';

    // Orthographic camera for 2D graphing
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
    this.camera.position.z = 10;

    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = IMM.bg;

    // Post-processing
    this.bloomEffect = new BloomEffect({
      intensity: opts.bloomStrength ?? IMM.bloomStrength,
      luminanceThreshold: opts.bloomThreshold ?? IMM.bloomThreshold,
      luminanceSmoothing: 0.3,
      kernelSize: KernelSize.MEDIUM,
      mipmapBlur: true,
    });

    const vignetteEffect = new VignetteEffect({
      darkness: 0.4,
      offset: 0.3,
    });

    const noiseEffect = new NoiseEffect({
      blendFunction: BlendFunction.OVERLAY,
    });
    noiseEffect.blendMode.opacity.value = 0.04;

    this.composer = new EffectComposer(this.renderer, {
      frameBufferType: THREE.HalfFloatType,
    });
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.composer.addPass(new EffectPass(this.camera, this.bloomEffect, vignetteEffect, noiseEffect));

    // Handle resize
    this._resizeObserver = new ResizeObserver(() => this._resize());
    this._resizeObserver.observe(this._container);
    this._resize();
  }

  private _resize() {
    const rect = this._container.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    if (w === this._width && h === this._height) return;
    this._width = w;
    this._height = h;

    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);

    // Update orthographic camera to match pixel dimensions
    this.camera.left = 0;
    this.camera.right = w;
    this.camera.top = 0;
    this.camera.bottom = h;
    this.camera.updateProjectionMatrix();
  }

  get width() { return this._width; }
  get height() { return this._height; }
  get canvas() { return this.renderer.domElement; }
  get resolution() { return new THREE.Vector2(this._width, this._height); }

  /** Set the per-frame render callback. Called before compose. */
  onBeforeRender(cb: () => void) {
    this._renderCallback = cb;
  }

  /** Start the render loop */
  start() {
    if (this._disposed) return;
    const loop = () => {
      if (this._disposed) return;
      this._animationId = requestAnimationFrame(loop);
      this._renderCallback?.();
      this.composer.render();
    };
    loop();
  }

  /** Stop the render loop */
  stop() {
    cancelAnimationFrame(this._animationId);
  }

  /** Clean up all resources */
  dispose() {
    this._disposed = true;
    this.stop();
    this._resizeObserver.disconnect();
    this.composer.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();

    // Dispose all scene objects
    this.scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        if (Array.isArray(obj.material)) {
          obj.material.forEach(m => m.dispose());
        } else {
          obj.material.dispose();
        }
      }
    });
    this.scene.clear();
  }
}
