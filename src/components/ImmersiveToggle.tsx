import { useState } from 'react';

interface Props {
  active: boolean;
  onToggle: () => void;
  loading?: boolean;
}

/**
 * Premium toggle button for Immersive Mode.
 * Shows a diamond/sparkle icon that glows when active.
 */
export default function ImmersiveToggle({ active, onToggle, loading }: Props) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      className={`immersive-toggle ${active ? 'active' : ''} ${loading ? 'loading' : ''}`}
      onClick={onToggle}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={active ? 'Exit Immersive Mode' : 'Enter Immersive Mode'}
      aria-label={active ? 'Exit Immersive Mode' : 'Enter Immersive Mode'}
      disabled={loading}
    >
      <svg
        width="16" height="16" viewBox="0 0 16 16" fill="none"
        className="immersive-toggle-icon"
        style={{
          filter: active || hovered
            ? 'drop-shadow(0 0 4px rgba(88, 196, 221, 0.6))'
            : 'none',
        }}
      >
        {/* 4-pointed star / diamond sparkle */}
        <path
          d="M8 0 L9.5 6.5 L16 8 L9.5 9.5 L8 16 L6.5 9.5 L0 8 L6.5 6.5 Z"
          fill={active ? '#58C4DD' : 'currentColor'}
          style={{ transition: 'fill 0.3s ease' }}
        />
      </svg>
      {loading && <span className="immersive-toggle-spinner" />}
    </button>
  );
}
