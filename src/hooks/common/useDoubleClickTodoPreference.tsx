import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from "react";

/**
 * Whether double-clicking a chat/thread/task-comment bubble adds the
 * message to the To-Do list. Defaults to `true` to preserve the
 * existing behaviour for users who already rely on the shortcut.
 *
 * Turning this off lets the browser's native double-click text-selection
 * work on the bubble body, which some users prefer.
 */

export interface DoubleClickTodoPreference {
    enabled: boolean;
}

const STORAGE_KEY = "genos-double-click-todo-preference:v1";
const DEFAULTS: DoubleClickTodoPreference = {
    enabled: true,
};

const readPreference = (): DoubleClickTodoPreference => {
    if (typeof window === "undefined") return DEFAULTS;
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return DEFAULTS;
        const parsed: unknown = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
            const obj = parsed as Record<string, unknown>;
            return {
                enabled: typeof obj.enabled === "boolean" ? obj.enabled : DEFAULTS.enabled,
            };
        }
        return DEFAULTS;
    } catch {
        return DEFAULTS;
    }
};

interface DoubleClickTodoPreferenceContextValue extends DoubleClickTodoPreference {
    setEnabled: (v: boolean) => void;
}

const DoubleClickTodoPreferenceContext =
    createContext<DoubleClickTodoPreferenceContextValue | null>(null);

export const DoubleClickTodoPreferenceProvider = ({ children }: { children: ReactNode }) => {
    const [prefs, setPrefs] = useState<DoubleClickTodoPreference>(readPreference);

    useEffect(() => {
        if (typeof window === "undefined") return;
        try {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
        } catch {
            // Quota / private mode — ignore. Default is the safer fallback.
        }
    }, [prefs]);

    const setEnabled = useCallback((v: boolean) => {
        setPrefs((p) => ({ ...p, enabled: v }));
    }, []);

    return (
        <DoubleClickTodoPreferenceContext.Provider value={{ ...prefs, setEnabled }}>
            {children}
        </DoubleClickTodoPreferenceContext.Provider>
    );
};

export const useDoubleClickTodoPreference = (): DoubleClickTodoPreferenceContextValue => {
    const ctx = useContext(DoubleClickTodoPreferenceContext);
    if (!ctx) {
        return { ...DEFAULTS, setEnabled: () => {} };
    }
    return ctx;
};
