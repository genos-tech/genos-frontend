/**
 * The slices behind the notes sidebar's render boundary (MIP-2379): what the sidebar reads from
 * the managers, as objects that change identity only when a value they carry changes.
 * (`useManagerSlice` itself is covered by `sidebarSlices.test.tsx`.)
 */

import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
    NOTE_SIDEBAR_SLICE_SPECS as SPECS,
    useNoteSidebarSlices,
} from "../features/notes/common/components/noteSidebarSlices";

const members = (name: keyof typeof SPECS): string[] => [
    ...SPECS[name].values,
    ...SPECS[name].latest,
];

// One value per picked member; the same tokens every time (state does not change when `AppBody`
// renders again), brand-new functions for every `latest` member, plus one member nothing carries.
const VALUES: Record<string, { token: string }> = {};
const make = (spec: (typeof SPECS)[keyof typeof SPECS], owner: string) => {
    const m: Record<string, unknown> = { notInAnySlice: 0 };
    for (const key of spec.values) m[key] = VALUES[`${owner}.${key}`] ??= { token: key };
    for (const key of spec.latest) m[key] = vi.fn(() => `${owner}.${key}`);
    return m;
};
const managers = () => {
    const useNM = { ...make(SPECS.shellNM, "nm"), ...make(SPECS.rowNM, "nm") };
    return {
        useNM,
        useCM: make(SPECS.cm, "cm"),
        useTEM: make(SPECS.tem, "tem"),
    };
};
const render = (m = managers()) =>
    renderHook((x: ReturnType<typeof managers>) => useNoteSidebarSlices(x as never), {
        initialProps: m,
    });

describe("useNoteSidebarSlices", () => {
    it("returns the same bundle for brand-new managers with the same values", () => {
        const { result, rerender } = render();
        const first = result.current;
        for (let i = 0; i < 5; i += 1) rerender(managers());
        expect(result.current).toBe(first);
    });

    it("an unrelated member changing moves no slice", () => {
        const { result, rerender } = render();
        const first = result.current;
        const next = managers();
        next.useNM.notInAnySlice = 1;
        next.useCM.notInAnySlice = 1;
        next.useTEM.notInAnySlice = 1;
        rerender(next);
        expect(result.current).toBe(first);
    });

    it("the row slice carries no current-note value: a note switch does not move it", () => {
        for (const key of [
            "currentMyNote",
            "currentTaskNote",
            "currentChatNote",
            "currentNoteType",
            "currentMyNoteChain",
            "tabsApi",
        ]) {
            expect(members("rowNM")).not.toContain(key);
        }
        const { result, rerender } = render();
        const before = result.current;
        const next = managers();
        next.useNM.currentMyNote = { token: "another note" };
        rerender(next);
        expect(result.current.shellNM).not.toBe(before.shellNM);
        expect(result.current.rowNM).toBe(before.rowNM);
    });

    it("functions a row calls while rendering are values, not latest-ref wrappers", () => {
        // A wrapper reads the last COMMIT, which is stale during a render.
        for (const key of [
            "isNodeExpanded",
            "isFolderExpanded",
            "isNoteFavorited",
            "isFolderFavorited",
        ]) {
            expect(SPECS.rowNM.values).toContain(key);
            expect(SPECS.rowNM.latest).not.toContain(key);
        }
    });

    it.each(SPECS.rowNM.values.map((k) => [k]))(
        "the row slice changes when its value %s changes (and the shell slice, if it carries it)",
        (key) => {
            const { result, rerender } = render();
            const before = result.current;
            const next = managers();
            next.useNM[key] = { token: "changed" };
            rerender(next);
            expect(result.current.rowNM).not.toBe(before.rowNM);
            if (members("shellNM").includes(key)) {
                expect(result.current.shellNM).not.toBe(before.shellNM);
            } else {
                expect(result.current.shellNM).toBe(before.shellNM);
            }
        }
    );

    it.each(SPECS.shellNM.latest.map((k) => [k]))(
        "%s keeps its identity when the manager recreates it, and calls the newest one",
        (key) => {
            const { result, rerender } = render();
            const first = result.current;
            const slice = first.shellNM as unknown as Record<string, (...a: unknown[]) => unknown>;
            const wrapper = slice[key];
            const next = managers();
            rerender(next);
            expect(result.current.shellNM).toBe(first.shellNM);
            expect(slice[key]).toBe(wrapper);
            expect(wrapper()).toBe(`nm.${key}`);
            expect(next.useNM[key]).toHaveBeenCalledTimes(1);
        }
    );
});
