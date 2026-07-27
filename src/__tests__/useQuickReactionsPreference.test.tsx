/**
 * The three one-click reaction emoji shown on bubble hover.
 *
 * Two things here are load-bearing beyond "it saves a string":
 *
 *  - The row is a **fixed three slots**. Anything short or corrupt read
 *    back from storage has to be padded from the defaults, because the
 *    settings UI indexes slots positionally and the bubbles map over the
 *    array — an `undefined` in there renders an empty button that reacts
 *    with nothing.
 *
 *  - A pick is stored in the same shape reactions are persisted in: a
 *    unicode glyph OR a team custom-emoji ":name:" shortcode. Both must
 *    round-trip untouched, since the value goes straight to the reaction
 *    API and to `EmojiGlyph`.
 */

import { ReactNode } from "react";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import {
    DEFAULT_QUICK_REACTIONS,
    QUICK_REACTION_SLOTS,
    QuickReactionsPreferenceProvider,
    useQuickReactionsPreference,
} from "../hooks/common/useQuickReactionsPreference";

const STORAGE_KEY = "genos-quick-reactions";

const wrapper = ({ children }: { children: ReactNode }) => (
    <QuickReactionsPreferenceProvider>{children}</QuickReactionsPreferenceProvider>
);

const renderPref = () => renderHook(() => useQuickReactionsPreference(), { wrapper });

beforeEach(() => {
    window.localStorage.clear();
});

describe("useQuickReactionsPreference", () => {
    it("starts at the shipped defaults", () => {
        const { result } = renderPref();
        expect(result.current.emojis).toEqual([...DEFAULT_QUICK_REACTIONS]);
    });

    it("replaces a single slot and leaves the others alone", () => {
        const { result } = renderPref();
        act(() => result.current.setEmojiAt(1, "🎉"));
        expect(result.current.emojis).toEqual([
            DEFAULT_QUICK_REACTIONS[0],
            "🎉",
            DEFAULT_QUICK_REACTIONS[2],
        ]);
    });

    it("persists the picks and reads them back", () => {
        const first = renderPref();
        act(() => first.result.current.setEmojiAt(0, "🔥"));
        expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY)!)[0]).toBe("🔥");

        // Fresh provider — simulates a reload.
        const second = renderPref();
        expect(second.result.current.emojis[0]).toBe("🔥");
    });

    it("round-trips a team custom-emoji shortcode verbatim", () => {
        const { result } = renderPref();
        act(() => result.current.setEmojiAt(2, ":shipit:"));
        expect(renderPref().result.current.emojis[2]).toBe(":shipit:");
    });

    it("pads a short stored array back to three slots", () => {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(["🔥"]));
        const { result } = renderPref();
        expect(result.current.emojis).toHaveLength(QUICK_REACTION_SLOTS);
        expect(result.current.emojis).toEqual([
            "🔥",
            DEFAULT_QUICK_REACTIONS[1],
            DEFAULT_QUICK_REACTIONS[2],
        ]);
    });

    it("falls back to defaults on corrupt storage rather than throwing", () => {
        window.localStorage.setItem(STORAGE_KEY, "{not json");
        const { result } = renderPref();
        expect(result.current.emojis).toEqual([...DEFAULT_QUICK_REACTIONS]);
    });

    it("ignores an out-of-range slot instead of growing the row", () => {
        const { result } = renderPref();
        act(() => result.current.setEmojiAt(QUICK_REACTION_SLOTS, "🎉"));
        expect(result.current.emojis).toHaveLength(QUICK_REACTION_SLOTS);
        expect(result.current.emojis).toEqual([...DEFAULT_QUICK_REACTIONS]);
    });

    it("resets back to the defaults", () => {
        const { result } = renderPref();
        act(() => result.current.setEmojiAt(0, "🔥"));
        act(() => result.current.reset());
        expect(result.current.emojis).toEqual([...DEFAULT_QUICK_REACTIONS]);
    });

    it("serves defaults without a provider so a bubble rendered alone still draws the row", () => {
        const { result } = renderHook(() => useQuickReactionsPreference());
        expect(result.current.emojis).toEqual([...DEFAULT_QUICK_REACTIONS]);
        // The no-op setter must not throw.
        expect(() => result.current.setEmojiAt(0, "🔥")).not.toThrow();
    });
});
