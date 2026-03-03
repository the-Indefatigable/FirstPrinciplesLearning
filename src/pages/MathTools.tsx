import DerivativeIntegral from '../tools/math/DerivativeIntegral';
import GraphingCalc from '../tools/math/GraphingCalc';
import MatrixCalc from '../tools/math/MatrixCalc';
import DiffEqSolver from '../tools/math/DiffEqSolver';
import Plotter3D from '../tools/math/Plotter3D';
import SlopeField from '../tools/math/SlopeField';
import UnitCircle from '../tools/math/UnitCircle';

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
                <UnitCircle />
                <Plotter3D />
                <SlopeField />
                <DerivativeIntegral />
                <GraphingCalc />
                <DiffEqSolver />
                <MatrixCalc />
            </div>
        </div>
    );
}
