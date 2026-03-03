import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * Custom hook to synchronize complex object state with a URL query parameter using JSON.
 */
export function useUrlState<T>(
    key: string,
    initialValue: T
): [T, (val: T | ((prev: T) => T)) => void] {
    const [searchParams, setSearchParams] = useSearchParams();

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

    // Sync state changes back to URL with a slight debounce or strict equality check
    useEffect(() => {
        const currentParams = Object.fromEntries(searchParams.entries());
        const stateStr = encodeURIComponent(JSON.stringify(state));

        // Only update if it actually changed to prevent infinite loops
        if (currentParams[key] !== stateStr) {
            setSearchParams(
                { ...currentParams, [key]: stateStr },
                { replace: true } // Don't build up history stack for every tick
            );
        }
    }, [state, key, searchParams, setSearchParams]);

    return [state, setState];
}
