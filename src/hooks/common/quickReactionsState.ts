import { createContext, useContext } from "react";

/**
 * The three one-click reaction emoji offered on bubble hover (chat
 * messages, thread replies, task comments) — Slack's "frequently used"
 * row, but user-picked rather than usage-derived.
 *
 * Stored as a JSON array of exactly `QUICK_REACTION_SLOTS` strings. Each
 * entry is a reaction value in the same shape reactions are persisted in:
 * either a unicode glyph ("👍") or a team custom-emoji shortcode
 * (":shipit:") — the same two forms `EmojiPicker` emits and `EmojiGlyph`
 * renders, so a custom team emoji can be a quick pick.
 *
 * localStorage-backed (like theme / bubble-style) rather than server-side:
 * nothing on the backend reads this, it only decides which buttons this
 * client draws.
 */
// Shared state for the quick-reaction row. Kept apart from useQuickReactionsPreference.tsx
// (the provider) so that file exports components only.

export const QUICK_REACTION_SLOTS = 3;

export const DEFAULT_QUICK_REACTIONS: readonly string[] = ["👍", "👀", "✅"];

export const STORAGE_KEY = "genos-quick-reactions";

/** Coerce anything read from storage into exactly three non-empty strings,
 *  padding from the defaults. A short/corrupt array must never shrink the
 *  row or render `undefined` into a button. */
const normalize = (value: unknown): string[] => {
    const arr = Array.isArray(value) ? value : [];
    return Array.from({ length: QUICK_REACTION_SLOTS }, (_, i) => {
        const entry = arr[i];
        return typeof entry === "string" && entry.length > 0 ? entry : DEFAULT_QUICK_REACTIONS[i];
    });
};

export const readPreference = (): string[] => {
    if (typeof window === "undefined") return [...DEFAULT_QUICK_REACTIONS];
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return [...DEFAULT_QUICK_REACTIONS];
        return normalize(JSON.parse(raw));
    } catch {
        // Malformed JSON / storage blocked — defaults are the safe read.
        return [...DEFAULT_QUICK_REACTIONS];
    }
};

interface QuickReactionsPreferenceContextValue {
    /** Always exactly `QUICK_REACTION_SLOTS` entries. */
    emojis: string[];
    /** Replace one slot. Out-of-range indexes are ignored. */
    setEmojiAt: (index: number, emoji: string) => void;
    /** Restore the shipped defaults. */
    reset: () => void;
}

export const QuickReactionsPreferenceContext =
    createContext<QuickReactionsPreferenceContextValue | null>(null);

export const useQuickReactionsPreference = (): QuickReactionsPreferenceContextValue => {
    const ctx = useContext(QuickReactionsPreferenceContext);
    if (!ctx) {
        // Provider not mounted (or consumed outside the tree — e.g. a unit
        // test rendering a bubble in isolation). Serve the defaults so the
        // quick-reaction row still renders instead of crashing.
        return {
            emojis: [...DEFAULT_QUICK_REACTIONS],
            setEmojiAt: () => {},
            reset: () => {},
        };
    }
    return ctx;
};
