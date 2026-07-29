import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from "react";

/**
 * Whether the task table's inline quick-add row enforces the project's
 * required-field rules before it will create a task.
 *
 * Defaults to `false` — quick-add is the FAST path. A row that refuses to
 * submit until an assignee, due date and tag are filled in is the slow
 * path with extra steps, and the sub-task quick-add
 * (`TaskSubTasksBlock`) has always created title-only tasks without
 * asking. This makes the table behave the same way, and gives the people
 * who do want creation policy applied to every entry point a way to say
 * so.
 *
 * What the toggle does NOT change:
 *   - Configured DEFAULTS still seed the draft row either way — that's a
 *     convenience, not a gate.
 *   - The full `CreateTaskForm` still enforces required fields. Turning
 *     this on aligns quick-add with it; turning it off exempts only the
 *     one-line create.
 *   - The rules were always UI-only (the API stores and serves the blob
 *     but never rejects a create — agent and internal creation paths must
 *     stay unaffected), so this widens no server-side hole.
 *
 * A user-level preference rather than a project-level one, deliberately:
 * it describes how the person wants to type, and the project owner's
 * policy still governs the full create form. `getQuickAddBlockingFields`
 * in `taskFieldRules.ts` is the single read point, so moving this to a
 * project-owner setting later is one function's worth of change.
 */

export interface QuickAddRequiredFieldsPreference {
    /** True = quick-add blocks on the project's required fields. */
    enforce: boolean;
}

const STORAGE_KEY = "genos-quick-add-required-fields-preference:v1";
const DEFAULTS: QuickAddRequiredFieldsPreference = {
    enforce: false,
};

const readPreference = (): QuickAddRequiredFieldsPreference => {
    if (typeof window === "undefined") return DEFAULTS;
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return DEFAULTS;
        const parsed: unknown = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
            const obj = parsed as Record<string, unknown>;
            return {
                enforce: typeof obj.enforce === "boolean" ? obj.enforce : DEFAULTS.enforce,
            };
        }
        return DEFAULTS;
    } catch {
        return DEFAULTS;
    }
};

interface QuickAddRequiredFieldsPreferenceContextValue extends QuickAddRequiredFieldsPreference {
    setEnforce: (v: boolean) => void;
}

const QuickAddRequiredFieldsPreferenceContext =
    createContext<QuickAddRequiredFieldsPreferenceContextValue | null>(null);

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

export const useQuickAddRequiredFieldsPreference =
    (): QuickAddRequiredFieldsPreferenceContextValue => {
        const ctx = useContext(QuickAddRequiredFieldsPreferenceContext);
        if (!ctx) {
            return { ...DEFAULTS, setEnforce: () => {} };
        }
        return ctx;
    };
