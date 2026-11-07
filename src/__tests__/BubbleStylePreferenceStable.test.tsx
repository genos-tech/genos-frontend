/**
 * The bubble-style context value is stable across re-renders of its parent.
 *
 * The provider sits in the App root's JSX, so every App-root write (a keystroke
 * in the Spotlight composer) re-renders it with a new `children` element. If the
 * value were a fresh object each time, every consumer would re-render with it:
 * the Spotlight conversation and the Ask modals read the preference to pass the
 * answer turn its `layout` (MIP-1165), and must only re-render when the setting
 * really changes (MIP-904).
 */

import { memo } from "react";
import { act, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
    BubbleStylePreferenceProvider,
    useBubbleStylePreference,
} from "../hooks/common/useBubbleStylePreference";

// The real UiSettingsProvider hands out a stable `set`; without it the hook gets a
// stand-in that is new on every render, which is not what the app has.
vi.mock("../hooks/common/useUiSettings", () => {
    const stable = { loaded: false, get: (_k: string, f: unknown) => f, set: () => {} };
    return { useUiSettings: () => stable };
});

describe("BubbleStylePreferenceProvider", () => {
    it("a memoised consumer renders once across parent re-renders, and again on a real change", () => {
        let renders = 0;
        let setStyle: ((s: "bubble" | "compact") => void) | null = null;
        const Consumer = memo(() => {
            const ctx = useBubbleStylePreference();
            setStyle = ctx.setStyle;
            renders += 1;
            return <span>{ctx.style}</span>;
        });
        const tree = (tick: number) => (
            <BubbleStylePreferenceProvider>
                <div data-tick={tick}>
                    <Consumer />
                </div>
            </BubbleStylePreferenceProvider>
        );
        const view = render(tree(0));
        expect(renders).toBe(1);
        for (let i = 1; i <= 5; i += 1) view.rerender(tree(i));
        expect(renders).toBe(1);
        act(() => setStyle?.("bubble"));
        expect(renders).toBe(2);
        view.unmount();
    });
});
