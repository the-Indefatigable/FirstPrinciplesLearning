import DoublePendulum from '../tools/physics/DoublePendulum';
import SpringMass from '../tools/physics/SpringMass';
import MomentumConservation from '../tools/physics/MomentumConservation';
import RayOptics from '../tools/physics/RayOptics';
import OrbitalMechanics from '../tools/physics/OrbitalMechanics';
import CircuitBuilder from '../tools/physics/CircuitBuilder';

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
                <CircuitBuilder />
                <OrbitalMechanics />
                <RayOptics />
                <DoublePendulum />
                <SpringMass />
                <MomentumConservation />
            </div>
        </div>
    );
}
