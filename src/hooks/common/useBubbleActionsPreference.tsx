import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from "react";

import { useUiSettings } from "./useUiSettings";

/**
 * Which message actions sit directly on the bubble's hover toolbar instead of
 * behind the "…" menu (MIP-803). Applies to chat messages and thread replies;
 * task comments have their own toolbar and are not affected.
 *
 * Stored as a list of action ids. The ORDER stored does not matter: the
 * toolbar always follows `PINNABLE_BUBBLE_ACTIONS`, which is the order of the
 * menu, so what a user pins reads the same as what they would have clicked.
 * Anything unknown, duplicated or over the limit is dropped on read, so a
 * list written by a newer build (or a corrupt one) can't render a button
 * that does nothing.
 *
 * Persistence mirrors `useBubbleStylePreference`: localStorage for the
 * synchronous first paint, the cross-device `ui_settings` store for sync,
 * and a write only on an EXPLICIT pick — an effect keyed on the value would
 * persist the default on mount and pin everyone to it.
 */

/** In the order the menu lists them (the shared order in `moreMenuOrder.ts`). */
export const PINNABLE_BUBBLE_ACTIONS = [
    "reply",
    "copyLink",
    "flag",
    "remindMe",
    "unwrapAll",
    "edit",
    "delete",
] as const;

export type PinnableBubbleAction = (typeof PINNABLE_BUBBLE_ACTIONS)[number];

/** The toolbar stays reasonable, and the "…" menu keeps something in it. */
export const MAX_PINNED_BUBBLE_ACTIONS = 4;

// Keep in sync with DEVICE_PREFERENCE_LOCAL_STORAGE_KEYS in
// context/AuthContext.tsx (a PRESERVE list — an unlisted key is wiped when a
// different user signs in on the same device).
const STORAGE_KEY = "genos-bubble-pinned-actions-v1";
// Key inside the cross-device `ui_settings` store.
const UI_SETTINGS_KEY = "bubblePinnedActions";

/** Coerce anything read from storage into a valid, ordered, capped list. */
export const normalizePinnedBubbleActions = (value: unknown): PinnableBubbleAction[] => {
    if (!Array.isArray(value)) return [];
    const asked = new Set<unknown>(value);
    return PINNABLE_BUBBLE_ACTIONS.filter((id) => asked.has(id)).slice(
        0,
        MAX_PINNED_BUBBLE_ACTIONS
    );
};

/** `null` = this device has no explicit pick (as opposed to an empty one). */
const readStored = (): PinnableBubbleAction[] | null => {
    if (typeof window === "undefined") return null;
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw === null) return null;
        const parsed: unknown = JSON.parse(raw);
        return Array.isArray(parsed) ? normalizePinnedBubbleActions(parsed) : null;
    } catch {
        return null;
    }
};

const sameList = (a: readonly string[], b: readonly string[]) =>
    a.length === b.length && a.every((id, i) => id === b[i]);

const writeStored = (ids: PinnableBubbleAction[]) => {
    if (typeof window === "undefined") return;
    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
    } catch {
        // Private mode / quota — the choice still applies for this session.
    }
};

interface BubbleActionsPreferenceContextValue {
    /** The pinned actions, in toolbar order. Empty = today's toolbar. */
    pinned: PinnableBubbleAction[];
    /** Pin or unpin one action. Pinning past the limit is ignored. */
    setPinned: (id: PinnableBubbleAction, pinned: boolean) => void;
    /** Unpin everything. */
    reset: () => void;
}

const BubbleActionsPreferenceContext = createContext<BubbleActionsPreferenceContextValue | null>(
    null
);

export const BubbleActionsPreferenceProvider = ({ children }: { children: ReactNode }) => {
    const { loaded, get, set } = useUiSettings();
    const [pinned, setPinnedState] = useState<PinnableBubbleAction[]>(() => readStored() ?? []);

    // Adopt the account's list once the server store loads; migrate an
    // explicit local pick up when the account has none yet.
    useEffect(() => {
        if (!loaded) return;
        const synced = get<unknown>(UI_SETTINGS_KEY, null);
        if (Array.isArray(synced)) {
            const next = normalizePinnedBubbleActions(synced);
            setPinnedState((prev) => (sameList(prev, next) ? prev : next));
            writeStored(next);
        } else {
            const stored = readStored();
            if (stored) set(UI_SETTINGS_KEY, stored);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loaded]);

    const commit = useCallback(
        (next: PinnableBubbleAction[]) => {
            setPinnedState(next);
            writeStored(next);
            set(UI_SETTINGS_KEY, next);
        },
        [set]
    );

    const setPinned = useCallback(
        (id: PinnableBubbleAction, on: boolean) => {
            // At the limit, ticking another is refused rather than letting
            // the cap drop an earlier pick (it cuts from the end of the menu
            // order, which is not the one just ticked).
            if (on && !pinned.includes(id) && pinned.length >= MAX_PINNED_BUBBLE_ACTIONS) return;
            const current = new Set<PinnableBubbleAction>(pinned);
            if (on) current.add(id);
            else current.delete(id);
            const next = normalizePinnedBubbleActions([...current]);
            commit(next);
        },
        [pinned, commit]
    );

    const reset = useCallback(() => commit([]), [commit]);

    return (
        <BubbleActionsPreferenceContext.Provider value={{ pinned, setPinned, reset }}>
            {children}
        </BubbleActionsPreferenceContext.Provider>
    );
};

export const useBubbleActionsPreference = (): BubbleActionsPreferenceContextValue => {
    const ctx = useContext(BubbleActionsPreferenceContext);
    if (!ctx) return { pinned: [], setPinned: () => {}, reset: () => {} };
    return ctx;
};
