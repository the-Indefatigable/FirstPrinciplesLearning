import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * Custom hook to synchronize complex object state with a URL query parameter using JSON.
 * Debounces URL updates to prevent flooding browser history during rapid state changes.
 */
export function useUrlState<T>(
    key: string,
    initialValue: T
): [T, (val: T | ((prev: T) => T)) => void] {
    const [searchParams, setSearchParams] = useSearchParams();
    const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

    // Initialize state from URL, or fallback to initialValue
    const [state, setState] = useState<T>(() => {
        const paramStr = searchParams.get(key);
        if (paramStr !== null) {
            try {
                return JSON.parse(decodeURIComponent(paramStr)) as T;
            } catch (e) {
                console.warn('Failed to parse URL state', e);
                return initialValue;
            }
        }
        return initialValue;
    });

    // Sync state changes back to URL with debounce
    useEffect(() => {
        clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            const currentParams = Object.fromEntries(searchParams.entries());
            const stateStr = encodeURIComponent(JSON.stringify(state));

            if (currentParams[key] !== stateStr) {
                setSearchParams(
                    { ...currentParams, [key]: stateStr },
                    { replace: true }
                );
            }
        }, 300);

        return () => clearTimeout(debounceRef.current);
    }, [state, key, searchParams, setSearchParams]);

    return [state, setState];
}
