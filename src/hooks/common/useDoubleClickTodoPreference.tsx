import { ReactNode, useCallback, useEffect, useState } from "react";

import {
    DoubleClickTodoPreference,
    DoubleClickTodoPreferenceContext,
    readPreference,
    STORAGE_KEY,
} from "./doubleClickTodoPreferenceState";

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
