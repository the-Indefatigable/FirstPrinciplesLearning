// Uses plotly-gl3d (surface/3D plots only) instead of the full plotly bundle.
// This is ~1.7 MB vs 4.8 MB — saves 3 MB on the lazy-loaded chunk.
// @ts-ignore — no types for partial dist build, but the API is identical
import Plotly from 'plotly.js/dist/plotly-gl3d.min.js';
import createPlotlyComponent from 'react-plotly.js/factory';

export default createPlotlyComponent(Plotly as any);
