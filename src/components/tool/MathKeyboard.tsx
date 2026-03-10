import { type MouseEvent as ReactMouseEvent } from 'react';

/* ─── Default key sets ─── */
const FULL_KEYS = [
    [
        { l: 'x', v: 'x' }, { l: 'y', v: 'y' }, { l: '(', v: '(' }, { l: ')', v: ')' },
        { l: '^', v: '^' }, { l: '/', v: '/' }, { l: '×', v: '*' },
    ],
    [
        { l: 'sin', v: 'sin(' }, { l: 'cos', v: 'cos(' }, { l: 'tan', v: 'tan(' },
        { l: 'ln', v: 'log(' }, { l: 'eˣ', v: 'exp(' }, { l: '√', v: 'sqrt(' }, { l: 'π', v: 'pi' },
    ],
    [
        { l: '7', v: '7' }, { l: '8', v: '8' }, { l: '9', v: '9' },
        { l: '4', v: '4' }, { l: '5', v: '5' }, { l: '6', v: '6' }, { l: '+', v: '+' },
    ],
    [
        { l: '1', v: '1' }, { l: '2', v: '2' }, { l: '3', v: '3' },
        { l: '0', v: '0' }, { l: '.', v: '.' }, { l: '−', v: '-' }, { l: 'e', v: 'e' },
    ],
];

interface MathKeyboardProps {
    onInsert: (text: string) => void;
    onBackspace?: () => void;
    onClear?: () => void;
    customKeys?: { l: string; v: string }[][];
    isDark?: boolean;
}

/**
 * Shared math keyboard component.
 * Renders a grid of symbol buttons that insert text at the cursor.
 */
export default function MathKeyboard({
    onInsert,
    onBackspace,
    onClear,
    customKeys,
    isDark = false,
}: MathKeyboardProps) {
    const keys = customKeys ?? FULL_KEYS;
    const borderC = isDark ? '#27272a' : '#e4e4e7';
    const keyBg = isDark ? '#27272a' : '#ffffff';
    const textColor = isDark ? '#ffffff' : '#000000';
    const dangerBg = isDark ? 'rgba(239,68,68,0.1)' : 'rgba(239,68,68,0.08)';
    const dangerColor = isDark ? '#ef4444' : '#dc2626';

    const prevent = (e: ReactMouseEvent) => e.preventDefault();

    return (
        <div style={{
            padding: 10,
            background: isDark ? '#18181b' : '#f3f4f6',
            borderRadius: 8,
            border: `1px solid ${borderC}`,
        }}>
            {keys.map((row, ri) => (
                <div key={ri} style={{ display: 'flex', gap: 4, marginBottom: ri < keys.length - 1 ? 4 : 0 }}>
                    {row.map(k => (
                        <button
                            key={k.l}
                            onMouseDown={prevent}
                            onClick={() => onInsert(k.v)}
                            style={{
                                flex: '1 1 0', padding: '10px 1px',
                                border: `1px solid ${borderC}`, borderRadius: 6,
                                background: keyBg, color: textColor,
                                fontFamily: 'system-ui', fontSize: '0.85rem',
                                fontWeight: 600, cursor: 'pointer',
                            }}
                        >
                            {k.l}
                        </button>
                    ))}
                </div>
            ))}

            {(onBackspace || onClear) && (
                <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                    {onBackspace && (
                        <button
                            onMouseDown={prevent}
                            onClick={onBackspace}
                            style={{
                                flex: 1, padding: '10px', border: `1px solid ${borderC}`,
                                borderRadius: 6, background: dangerBg, color: dangerColor,
                                fontFamily: 'system-ui', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer',
                            }}
                        >
                            ⌫
                        </button>
                    )}
                    {onClear && (
                        <button
                            onMouseDown={prevent}
                            onClick={onClear}
                            style={{
                                flex: 1, padding: '10px', border: `1px solid ${borderC}`,
                                borderRadius: 6, background: dangerBg, color: dangerColor,
                                fontFamily: 'system-ui', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer',
                            }}
                        >
                            Clear
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
