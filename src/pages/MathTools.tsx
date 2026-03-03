import DerivativeIntegral from '../tools/math/DerivativeIntegral';
import GraphingCalc from '../tools/math/GraphingCalc';
import MatrixCalc from '../tools/math/MatrixCalc';
import DiffEqSolver from '../tools/math/DiffEqSolver';

export default function MathTools() {
    return (
        <div className="tool-page">
            <div className="tool-page-header">
                <h1>Mathematics Tools</h1>
                <p>Calculus, linear algebra, and graphing — all in one place.</p>
            </div>
            <div className="tool-grid tool-grid--1col">
                <DerivativeIntegral />
                <GraphingCalc />
                <DiffEqSolver />
                <MatrixCalc />
            </div>
        </div>
    );
}
