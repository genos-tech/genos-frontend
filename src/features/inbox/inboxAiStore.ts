// What the member has switched in this session, shared by every card of the same source
// (MIP-1227).
//
// Several digest cards share ONE switch (`digest_enabled`) and several reports share one
// schedule, and Virtuoso unmounts a row that scrolls away. So the answer to "is this source on?"
// cannot live in a card's own state: switch the digest off on one card and every other digest
// card must say so, and a card scrolled away and back must still show its Undo.
//
// A tiny external store (read with `useSyncExternalStore`): a card subscribes to its own source
// key and its own item id, and re-renders only when ITS entry is replaced. It sits beside the
// memoized report card, not inside it, so a switch never re-renders a card's body.

export type SourceState = { enabled: boolean; gone: boolean };

export type SwitchNotice =
    /** Just turned off. `undoable`: it was on before, so Undo is honest. */
    | { kind: "off"; undoable: boolean }
    | { kind: "already-off" }
    | { kind: "on" }
    | { kind: "error"; reason: "gone" | "plan" | "error"; error: string | null };

const sources = new Map<string, SourceState>();
const notices = new Map<number, SwitchNotice>();
const listeners = new Set<() => void>();

const emit = () => {
    for (const listener of [...listeners]) listener();
};

export const subscribeInboxAi = (listener: () => void): (() => void) => {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
};

export const getSourceState = (key: string): SourceState | undefined => sources.get(key);
export const getSwitchNotice = (itemId: number): SwitchNotice | undefined => notices.get(itemId);

export const setSourceState = (key: string, state: SourceState) => {
    const current = sources.get(key);
    // Replace only on a change: a snapshot that is `Object.is`-equal re-renders nobody.
    if (current && current.enabled === state.enabled && current.gone === state.gone) return;
    sources.set(key, state);
    emit();
};

export const setSwitchNotice = (itemId: number, notice: SwitchNotice | null) => {
    if (notice === null) notices.delete(itemId);
    else notices.set(itemId, notice);
    emit();
};

/** Forget everything (a test, or the member signing out). */
export const resetInboxAiStore = () => {
    sources.clear();
    notices.clear();
    emit();
};
