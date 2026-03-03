import { lazy, Suspense } from 'react';
import ToolSkeleton from '../components/ToolSkeleton';
import VisibleOnScroll from '../components/VisibleOnScroll';

const Pathfinding         = lazy(() => import('../tools/cs/Pathfinding'));
const SqlVisualizer       = lazy(() => import('../tools/cs/SqlVisualizer'));
const SortingVisualizer   = lazy(() => import('../tools/cs/SortingVisualizer'));
const GraphTraversal      = lazy(() => import('../tools/cs/GraphTraversal'));
const RecursionVisualizer = lazy(() => import('../tools/cs/RecursionVisualizer'));
const CodeExecutor        = lazy(() => import('../tools/cs/CodeExecutor'));

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
                <LazyTool label="Pathfinding"><Pathfinding /></LazyTool>
                <LazyTool label="SQL Visualizer"><SqlVisualizer /></LazyTool>
                <LazyTool label="Sorting Visualizer"><SortingVisualizer /></LazyTool>
                <LazyTool label="Graph Traversal"><GraphTraversal /></LazyTool>
                <LazyTool label="Recursion Visualizer"><RecursionVisualizer /></LazyTool>
                <LazyTool label="Code Executor"><CodeExecutor /></LazyTool>
            </div>
        </div>
    );
}
