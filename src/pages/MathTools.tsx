import { lazy, Suspense } from 'react';
import ToolSkeleton from '../components/ToolSkeleton';
import VisibleOnScroll from '../components/VisibleOnScroll';

// Each tool is its own chunk — mathjs/Plotly only download when /math is visited
const UnitCircle         = lazy(() => import('../tools/math/UnitCircle'));
const Plotter3D          = lazy(() => import('../tools/math/Plotter3D'));
const SlopeField         = lazy(() => import('../tools/math/SlopeField'));
const DerivativeIntegral = lazy(() => import('../tools/math/DerivativeIntegral'));
const GraphingCalc       = lazy(() => import('../tools/math/GraphingCalc'));
const DiffEqSolver       = lazy(() => import('../tools/math/DiffEqSolver'));
const MatrixCalc         = lazy(() => import('../tools/math/MatrixCalc'));

function LazyTool({ label, children }: { label: string; children: React.ReactNode }) {
    const skeleton = <ToolSkeleton label={label} />;
    return (
        <VisibleOnScroll placeholder={skeleton}>
            <Suspense fallback={skeleton}>
                {children}
            </Suspense>
        </VisibleOnScroll>
    );
}

export default function MathTools() {
    return (
        <div className="tool-page">
            <div className="tool-page-header">
                <div className="tool-page-eyebrow">
                    <span className="eyebrow-line" />
                    <span>Interactive Tools</span>
                    <span className="eyebrow-line" />
                </div>
                <h1>Mathematics</h1>
                <p>Calculus, linear algebra, and graphing — built to make abstract ideas click.</p>
                <div className="tool-count-badge">
                    <span className="count-dot" />
                    7 interactive tools
                </div>
            </div>
            <div className="tool-grid tool-grid--1col">
                <LazyTool label="Unit Circle"><UnitCircle /></LazyTool>
                <LazyTool label="3D Surface Plotter"><Plotter3D /></LazyTool>
                <LazyTool label="Slope Field"><SlopeField /></LazyTool>
                <LazyTool label="Differentiation & Integration"><DerivativeIntegral /></LazyTool>
                <LazyTool label="Graphing Calculator"><GraphingCalc /></LazyTool>
                <LazyTool label="Differential Equation Solver"><DiffEqSolver /></LazyTool>
                <LazyTool label="Matrix Calculator"><MatrixCalc /></LazyTool>
            </div>
        </div>
    );
}
