/**
 * The message actions pinned onto the bubble hover toolbar (MIP-803).
 *
 * Load-bearing beyond "it saves a list":
 *
 *  - Whatever order or junk is stored, the toolbar follows the MENU's order and
 *    only ever holds known ids, so a corrupt or newer-build value can't render
 *    a button that does nothing.
 *  - The limit is enforced when ticking, and ticking past it must not drop an
 *    earlier pick (the cap cuts from the end of the menu order, which is not
 *    the one just ticked).
 *  - Nothing is written until the user picks: the default is "nothing pinned".
 */

import { ReactNode } from "react";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import {
    BubbleActionsPreferenceProvider,
    MAX_PINNED_BUBBLE_ACTIONS,
    normalizePinnedBubbleActions,
    useBubbleActionsPreference,
} from "../hooks/common/useBubbleActionsPreference";

const STORAGE_KEY = "genos-bubble-pinned-actions-v1";

const wrapper = ({ children }: { children: ReactNode }) => (
    <BubbleActionsPreferenceProvider>{children}</BubbleActionsPreferenceProvider>
);
const renderPref = () => renderHook(() => useBubbleActionsPreference(), { wrapper });

beforeEach(() => window.localStorage.clear());

describe("normalizePinnedBubbleActions", () => {
    it("follows the menu order, drops unknowns and duplicates", () => {
        expect(normalizePinnedBubbleActions(["delete", "nope", "reply", "reply", 3])).toEqual([
            "reply",
            "delete",
        ]);
    });

    it("caps at the limit and treats a non-list as nothing pinned", () => {
        expect(
            normalizePinnedBubbleActions(["reply", "flag", "remindMe", "copyLink", "unwrapAll"])
        ).toHaveLength(MAX_PINNED_BUBBLE_ACTIONS);
        expect(normalizePinnedBubbleActions("reply")).toEqual([]);
        expect(normalizePinnedBubbleActions(null)).toEqual([]);
    });
});

describe("useBubbleActionsPreference", () => {
    it("starts with nothing pinned and writes nothing", () => {
        const { result } = renderPref();
        expect(result.current.pinned).toEqual([]);
        expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
    });

    it("reads a stored list, in menu order", () => {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(["edit", "flag", "junk"]));
        expect(renderPref().result.current.pinned).toEqual(["flag", "edit"]);
    });

    it("survives corrupt storage", () => {
        window.localStorage.setItem(STORAGE_KEY, "{not json");
        expect(renderPref().result.current.pinned).toEqual([]);
    });

    it("pins and unpins, and persists the explicit pick", () => {
        const { result } = renderPref();
        act(() => result.current.setPinned("flag", true));
        act(() => result.current.setPinned("reply", true));
        expect(result.current.pinned).toEqual(["reply", "flag"]);
        expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY)!)).toEqual(["reply", "flag"]);

        act(() => result.current.setPinned("reply", false));
        expect(result.current.pinned).toEqual(["flag"]);
    });

    it("refuses a pick past the limit without dropping an earlier one", () => {
        const { result } = renderPref();
        for (const id of ["flag", "remindMe", "copyLink", "unwrapAll"] as const) {
            act(() => result.current.setPinned(id, true));
        }
        expect(result.current.pinned).toHaveLength(MAX_PINNED_BUBBLE_ACTIONS);

        // "reply" sorts BEFORE all four; a naive cap would keep it and drop unwrapAll.
        act(() => result.current.setPinned("reply", true));
        expect(result.current.pinned).toEqual(["copyLink", "flag", "remindMe", "unwrapAll"]);
    });

    it("reset unpins everything", () => {
        const { result } = renderPref();
        act(() => result.current.setPinned("flag", true));
        act(() => result.current.reset());
        expect(result.current.pinned).toEqual([]);
    });
});
