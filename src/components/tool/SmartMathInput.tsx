import { useState, useRef, useCallback, useMemo } from 'react';
import Tex from './Tex';
import { exprToLatex } from '../../utils/mathHelpers';

interface SmartMathInputProps {
    value: string;
    onChange: (val: string) => void;
    onSubmit?: () => void;
    variable?: string;
    placeholder?: string;
    isDark?: boolean;
}

/**
 * "Smart Toggle" math input.
 * - Default state: displays rendered KaTeX. Click to edit.
 * - Editing state: shows raw text input. Blur or Enter to switch back.
 */
export default function SmartMathInput({
    value,
    onChange,
    onSubmit,
    variable = 'x',
    placeholder = 'type here...',
    isDark = false,
}: SmartMathInputProps) {
    const [isEditing, setIsEditing] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const startEditing = useCallback(() => {
        setIsEditing(true);
        setTimeout(() => inputRef.current?.focus(), 10);
    }, []);

    const preview = useMemo(() => exprToLatex(value), [value]);

    const borderC = isDark ? '#27272a' : '#e4e4e7';
    const inputBg = isDark ? '#18181b' : '#f3f4f6';
    const textPrimary = isDark ? '#ffffff' : '#000000';
    const textDim = isDark ? '#9ca3af' : '#6b7280';
    const amber = '#d97706';

    return (
        <div
            onClick={() => { if (!isEditing) startEditing(); }}
            style={{
                border: `1.5px solid ${isEditing ? amber : borderC}`,
                borderRadius: 10,
                background: inputBg,
                transition: 'all 0.15s',
                cursor: isEditing ? 'text' : 'pointer',
                minHeight: 60,
                display: 'flex',
                alignItems: 'center',
                padding: '0 16px',
                boxShadow: isEditing
                    ? (isDark ? '0 0 0 2px rgba(217,119,6,0.2)' : '0 0 0 2px rgba(217,119,6,0.1)')
                    : 'none',
            }}
        >
            {isEditing ? (
                <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                    <span style={{ color: amber, fontSize: '1.1rem', fontWeight: 700, marginRight: 8, userSelect: 'none' }}>›</span>
                    <input
                        ref={inputRef}
                        value={value}
                        onChange={e => onChange(e.target.value)}
                        onBlur={() => setIsEditing(false)}
                        onKeyDown={e => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                setIsEditing(false);
                                onSubmit?.();
                            }
                        }}
                        placeholder={placeholder}
                        spellCheck={false}
                        style={{
                            flex: 1, border: 'none', background: 'transparent',
                            fontFamily: 'monospace', fontSize: '1.05rem',
                            outline: 'none', color: textPrimary,
                            width: '100%', padding: '16px 0',
                        }}
                    />
                </div>
            ) : (
                <div style={{ width: '100%', overflowX: 'auto', padding: '16px 0' }}>
                    <span style={{ color: textDim, fontSize: '1rem', fontWeight: 600, marginRight: 8 }}>
                        f({variable}) =
                    </span>
                    <span style={{ fontSize: '1.3rem', color: textPrimary }}>
                        <Tex math={preview} />
                    </span>
                </div>
            )}
        </div>
    );
}
