import { lazy, Suspense } from 'react';
import ToolSkeleton from '../components/ToolSkeleton';
import VisibleOnScroll from '../components/VisibleOnScroll';

// Physics sims start canvas animation loops on mount — VisibleOnScroll prevents
// all 6 rAF loops from firing before the user scrolls to them
const CircuitBuilder       = lazy(() => import('../tools/physics/CircuitBuilder'));
const OrbitalMechanics    = lazy(() => import('../tools/physics/OrbitalMechanics'));
const RayOptics           = lazy(() => import('../tools/physics/RayOptics'));
const DoublePendulum      = lazy(() => import('../tools/physics/DoublePendulum'));
const SpringMass          = lazy(() => import('../tools/physics/SpringMass'));
const MomentumConservation = lazy(() => import('../tools/physics/MomentumConservation'));

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

export default function PhysicsTools() {
    return (
        <div className="tool-page">
            <div className="tool-page-header">
                <div className="tool-page-eyebrow">
                    <span className="eyebrow-line" />
                    <span>Interactive Tools</span>
                    <span className="eyebrow-line" />
                </div>
                <h1>Physics Simulations</h1>
                <p>Tweak parameters and watch the laws of physics unfold in real time.</p>
                <div className="tool-count-badge">
                    <span className="count-dot" />
                    6 interactive simulations
                </div>
            </div>
            <div className="tool-grid tool-grid--1col">
                <LazyTool label="Circuit Builder"><CircuitBuilder /></LazyTool>
                <LazyTool label="Orbital Gravity Simulator"><OrbitalMechanics /></LazyTool>
                <LazyTool label="Ray Optics"><RayOptics /></LazyTool>
                <LazyTool label="Double Pendulum"><DoublePendulum /></LazyTool>
                <LazyTool label="Spring-Mass System"><SpringMass /></LazyTool>
                <LazyTool label="Momentum Conservation"><MomentumConservation /></LazyTool>
            </div>
        </div>
    );
}
