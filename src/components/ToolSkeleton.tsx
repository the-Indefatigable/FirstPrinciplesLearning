export default function ToolSkeleton({ label = 'tool' }: { label?: string }) {
    return (
        <div className="tool-card" aria-label={`Loading ${label}…`} style={{ minHeight: 220 }}>
            <div className="tool-card-header">
                <div className="skeleton-line" style={{ width: 200, height: 22 }} />
            </div>
            <div className="tool-card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="skeleton-block" style={{ height: 140 }} />
                <div className="skeleton-line" style={{ width: '55%', height: 14 }} />
            </div>
        </div>
    );
}
