import { ReactNode, useCallback, useEffect, useState } from "react";

import {
    QuickAddRequiredFieldsPreference,
    QuickAddRequiredFieldsPreferenceContext,
    readPreference,
    STORAGE_KEY,
} from "./quickAddRequiredFieldsPreferenceState";

export const QuickAddRequiredFieldsPreferenceProvider = ({
    children,
}: {
    children: ReactNode;
}) => {
    const [prefs, setPrefs] = useState<QuickAddRequiredFieldsPreference>(readPreference);

    useEffect(() => {
        if (typeof window === "undefined") return;
        try {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
        } catch {
            // Quota / private mode — ignore. Default is the safer fallback.
        }
    }, [prefs]);

    const setEnforce = useCallback((v: boolean) => {
        setPrefs((p) => ({ ...p, enforce: v }));
    }, []);

    return (
        <QuickAddRequiredFieldsPreferenceContext.Provider value={{ ...prefs, setEnforce }}>
            {children}
        </QuickAddRequiredFieldsPreferenceContext.Provider>
    );
};
