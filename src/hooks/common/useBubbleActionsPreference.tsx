import { ReactNode, useCallback, useEffect, useState } from "react";

import {
    BubbleActionsPreferenceContext,
    MAX_PINNED_BUBBLE_ACTIONS,
    normalizePinnedBubbleActions,
    PinnableBubbleAction,
    readStored,
    sameList,
    UI_SETTINGS_KEY,
    writeStored,
} from "./bubbleActionsPreferenceState";
import { useUiSettings } from "./uiSettingsState";

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
