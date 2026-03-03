import DoublePendulum from '../tools/physics/DoublePendulum';
import SpringMass from '../tools/physics/SpringMass';
import MomentumConservation from '../tools/physics/MomentumConservation';

export default function PhysicsTools() {
    return (
        <div className="tool-page">
            <div className="tool-page-header">
                <h1>Physics Simulations</h1>
                <p>Interactive mechanics — tweak parameters and watch physics unfold.</p>
            </div>
            <div className="tool-grid tool-grid--1col">
                <DoublePendulum />
                <SpringMass />
                <MomentumConservation />
            </div>
        </div>
    );
}
