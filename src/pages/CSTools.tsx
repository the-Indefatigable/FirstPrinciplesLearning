import SortingVisualizer from '../tools/cs/SortingVisualizer';
import GraphTraversal from '../tools/cs/GraphTraversal';
import RecursionVisualizer from '../tools/cs/RecursionVisualizer';
import CodeExecutor from '../tools/cs/CodeExecutor';
import Pathfinding from '../tools/cs/Pathfinding';
import SqlVisualizer from '../tools/cs/SqlVisualizer';

export default function CSTools() {
    return (
        <div className="tool-page">
            <div className="tool-page-header">
                <div className="tool-page-eyebrow">
                    <span className="eyebrow-line" />
                    <span>Interactive Tools</span>
                    <span className="eyebrow-line" />
                </div>
                <h1>Computer Science</h1>
                <p>Visualize algorithms, traverse graphs, and run code — all in the browser.</p>
                <div className="tool-count-badge">
                    <span className="count-dot" />
                    6 interactive tools
                </div>
            </div>
            <div className="tool-grid tool-grid--1col">
                <Pathfinding />
                <SqlVisualizer />
                <SortingVisualizer />
                <GraphTraversal />
                <RecursionVisualizer />
                <CodeExecutor />
            </div>
        </div>
    );
}
