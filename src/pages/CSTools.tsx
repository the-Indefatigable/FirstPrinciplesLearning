import SortingVisualizer from '../tools/cs/SortingVisualizer';
import GraphTraversal from '../tools/cs/GraphTraversal';
import RecursionVisualizer from '../tools/cs/RecursionVisualizer';
import CodeExecutor from '../tools/cs/CodeExecutor';

export default function CSTools() {
    return (
        <div className="tool-page">
            <div className="tool-page-header">
                <h1>Computer Science Tools</h1>
                <p>Visualize algorithms, traverse graphs, and run code — all in the browser.</p>
            </div>
            <div className="tool-grid tool-grid--1col">
                <SortingVisualizer />
                <GraphTraversal />
                <RecursionVisualizer />
                <CodeExecutor />
            </div>
        </div>
    );
}
