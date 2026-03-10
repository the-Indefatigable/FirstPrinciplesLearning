import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

type Theme = 'light' | 'dark' | 'system';

interface ThemeCtx {
    theme: Theme;
    setTheme: (t: Theme) => void;
    resolved: 'light' | 'dark';
}

const ThemeContext = createContext<ThemeCtx>({
    theme: 'system',
    setTheme: () => { },
    resolved: 'light',
});

export const useTheme = () => useContext(ThemeContext);

/** Convenience: returns `true` when the resolved theme is 'dark'. */
export const useIsDark = () => useTheme().resolved === 'dark';

function getSystemPref(): 'light' | 'dark' {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(resolved: 'light' | 'dark') {
    document.documentElement.setAttribute('data-theme', resolved);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
    const [theme, setThemeState] = useState<Theme>(() => {
        const stored = localStorage.getItem('fp-theme') as Theme | null;
        return stored ?? 'system';
    });

    const [resolved, setResolved] = useState<'light' | 'dark'>(() => {
        const stored = localStorage.getItem('fp-theme') as Theme | null;
        const t = stored ?? 'system';
        return t === 'system' ? getSystemPref() : t;
    });

    const setTheme = (t: Theme) => {
        setThemeState(t);
        localStorage.setItem('fp-theme', t);
    };

    // Resolve theme whenever preference or system changes
    useEffect(() => {
        const resolve = () => {
            const r = theme === 'system' ? getSystemPref() : theme;
            setResolved(r);
            applyTheme(r);
        };

        resolve();

        if (theme === 'system') {
            const mq = window.matchMedia('(prefers-color-scheme: dark)');
            const handler = () => resolve();
            mq.addEventListener('change', handler);
            return () => mq.removeEventListener('change', handler);
        }
    }, [theme]);

    return (
        <ThemeContext.Provider value={{ theme, setTheme, resolved }}>
            {children}
        </ThemeContext.Provider>
    );
}
