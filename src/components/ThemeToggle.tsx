import { useTheme } from '../hooks/useTheme';
import './ThemeToggle.css';

const ICONS: Record<string, string> = {
    light: '☀️',
    dark: '🌙',
    system: '💻',
};

export default function ThemeToggle() {
    const { theme, setTheme } = useTheme();

    const options = ['light', 'dark', 'system'] as const;

    return (
        <div className="theme-toggle" role="radiogroup" aria-label="Choose theme">
            {options.map(opt => (
                <button
                    key={opt}
                    className={`theme-toggle-btn ${theme === opt ? 'active' : ''}`}
                    onClick={() => setTheme(opt)}
                    aria-checked={theme === opt}
                    role="radio"
                    title={opt.charAt(0).toUpperCase() + opt.slice(1)}
                >
                    <span className="theme-icon">{ICONS[opt]}</span>
                </button>
            ))}
        </div>
    );
}
