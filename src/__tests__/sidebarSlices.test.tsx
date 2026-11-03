/**
 * The slice hooks behind the task sidebar's render boundary (MIP-971).
 *
 * A slice is a narrow view of a manager that changes identity only when one of
 * the VALUES it carries changes, and whose functions never change identity but
 * always call the newest implementation (the "latest ref" idea of
 * `useAvatarContextValue`, MIP-958).
 */

import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
    SIDEBAR_SLICE_SPECS,
    useSidebarSlices,
} from "../features/tasks/components/sidebar/useSidebarSlices";
import { useManagerSlice } from "../hooks/common/useManagerSlice";

// ------------------------------------------------------------- useManagerSlice

type Manager = {
    count: number;
    label: string;
    setCount: (n: number) => string;
    run: (a: number, b: number) => number;
    other: number;
};

const SPEC = {
    values: ["count", "label", "setCount"],
    latest: ["run"],
} as const;

const manager = (over: Partial<Manager> = {}): Manager => ({
    count: 1,
    label: "a",
    setCount: () => "set",
    run: (a, b) => a + b,
    other: 0,
    ...over,
});

describe("useManagerSlice", () => {
    it("carries exactly the picked members", () => {
        const { result } = renderHook(() => useManagerSlice(manager(), SPEC));
        expect(Object.keys(result.current).sort()).toEqual(["count", "label", "run", "setCount"]);
        expect(result.current.count).toBe(1);
        expect(result.current.label).toBe("a");
    });

    it("returns the same slice for a new manager object with the same picked values", () => {
        // `setCount` is the same function in every manager: it stands for a stable setter.
        const setCount = () => "set";
        const { result, rerender } = renderHook((m: Manager) => useManagerSlice(m, SPEC), {
            initialProps: manager({ setCount }),
        });
        const first = result.current;
        // New objects, a brand-new `run` each time (as in the real hooks), unrelated `other` changes.
        for (let i = 0; i < 5; i += 1) {
            rerender(manager({ setCount, other: i, run: (a, b) => a * b }));
        }
        expect(result.current).toBe(first);
    });

    it.each<[string, Partial<Manager>]>([
        ["count", { count: 2 }],
        ["label", { label: "b" }],
        ["setCount (an already-stable function that was replaced)", { setCount: () => "new" }],
    ])("returns a new slice when the picked value %s changes", (_name, change) => {
        const setCount = () => "set";
        const { result, rerender } = renderHook((m: Manager) => useManagerSlice(m, SPEC), {
            initialProps: manager({ setCount }),
        });
        const first = result.current;
        rerender(manager({ setCount, ...change }));
        expect(result.current).not.toBe(first);
    });

    it("keeps a latest function's identity across renders and manager objects", () => {
        const { result, rerender } = renderHook((m: Manager) => useManagerSlice(m, SPEC), {
            initialProps: manager(),
        });
        const first = result.current.run;
        rerender(manager({ run: (a, b) => a - b }));
        rerender(manager({ run: (a, b) => a * b }));
        expect(result.current.run).toBe(first);
    });

    it("a latest function calls the NEWEST implementation, not the one from the first render", () => {
        const first = vi.fn((a: number, b: number) => a + b);
        const second = vi.fn((a: number, b: number) => a * b);
        const third = vi.fn((a: number, b: number) => a - b);
        const { result, rerender } = renderHook((m: Manager) => useManagerSlice(m, SPEC), {
            initialProps: manager({ run: first }),
        });
        const wrapper = result.current.run;
        expect(wrapper(3, 4)).toBe(7);
        expect(first).toHaveBeenCalledTimes(1);

        rerender(manager({ run: second }));
        expect(wrapper(3, 4)).toBe(12);
        expect(second).toHaveBeenCalledWith(3, 4);
        expect(first).toHaveBeenCalledTimes(1);

        rerender(manager({ run: third }));
        // The wrapper handed out at the very first render, called again.
        expect(wrapper(3, 4)).toBe(-1);
        expect(second).toHaveBeenCalledTimes(1);
        expect(third).toHaveBeenCalledTimes(1);
    });

    it("a latest function is called on the manager, with its arguments and return value", () => {
        const seen: unknown[] = [];
        const m = manager();
        m.run = function (this: unknown, a: number, b: number) {
            seen.push(this);
            return a + b + 100;
        };
        const { result } = renderHook(() => useManagerSlice(m, SPEC));
        expect(result.current.run(1, 2)).toBe(103);
        expect(seen[0]).toBe(m);
    });

    it("a latest function reads the manager of the last COMMIT, not of a render that was not committed", () => {
        const committed = vi.fn(() => 1);
        const { result, rerender } = renderHook(
            (m: Manager) => useManagerSlice(m, { values: [], latest: ["run"] } as const),
            { initialProps: manager({ run: committed }) }
        );
        const notCommitted = vi.fn(() => 2);
        // Building a manager is not a render: only a committed render moves the ref.
        manager({ run: notCommitted });
        expect(result.current.run(0, 0)).toBe(1);
        rerender(manager({ run: notCommitted }));
        expect(result.current.run(0, 0)).toBe(2);
    });
});

// ------------------------------------------------------------ useSidebarSlices

type Bundle = ReturnType<typeof useSidebarSlices>;
type SliceName = keyof typeof SIDEBAR_SLICE_SPECS;
type ManagerName = "usePM" | "useTM" | "useSM" | "useTEM" | "useCM";
type Managers = Record<ManagerName, Record<string, unknown>>;

const SLICE_OF: Record<SliceName, (b: Bundle) => unknown> = {
    shellTM: (b) => b.shell.tm,
    shellPM: (b) => b.shell.pm,
    searchTM: (b) => b.search.tm,
    tableViewTM: (b) => b.tableView.tm,
    boardViewTM: (b) => b.boardView.tm,
    recentsTM: (b) => b.recents.tm,
    recentsPM: (b) => b.recents.pm,
    treeTM: (b) => b.tree.tm,
    treePM: (b) => b.tree.pm,
    treeSM: (b) => b.tree.sm,
    treeTEM: (b) => b.tree.tem,
    treeCM: (b) => b.tree.cm,
};
const MANAGER_OF: Record<SliceName, ManagerName> = {
    shellTM: "useTM",
    shellPM: "usePM",
    searchTM: "useTM",
    tableViewTM: "useTM",
    boardViewTM: "useTM",
    recentsTM: "useTM",
    recentsPM: "usePM",
    treeTM: "useTM",
    treePM: "usePM",
    treeSM: "useSM",
    treeTEM: "useTEM",
    treeCM: "useCM",
};
const SLICE_NAMES = Object.keys(SIDEBAR_SLICE_SPECS) as SliceName[];

// A value for a picked member. Functions are never called through a `values`
// member, so a distinct token per key is enough.
const token = (manager: string, key: string) => ({ token: `${manager}.${key}` });
const VALUE_TOKENS: Record<string, { token: string }> = {};

// One manager per call: a brand-new object, brand-new functions for every
// `latest` member, the SAME tokens for every value (state does not change when
// `AppBody` renders again), plus a member no slice carries.
const makeManagers = (): Managers => {
    const out: Managers = { usePM: {}, useTM: {}, useSM: {}, useTEM: {}, useCM: {} };
    for (const name of SLICE_NAMES) {
        const m = MANAGER_OF[name];
        const spec = SIDEBAR_SLICE_SPECS[name];
        for (const key of spec.values) out[m][key] = VALUE_TOKENS[`${m}.${key}`] ??= token(m, key);
        for (const key of spec.latest) out[m][key] = vi.fn(() => `${m}.${key}`);
    }
    for (const m of Object.keys(out) as ManagerName[]) out[m].notInAnySlice = 0;
    return out;
};
const render = (managers: Managers) =>
    renderHook((m: Managers) => useSidebarSlices(m as never), { initialProps: managers });

describe("useSidebarSlices", () => {
    it("builds every slice once and returns the same bundle for brand-new managers with the same values", () => {
        const { result, rerender } = render(makeManagers());
        const first = result.current;
        for (let i = 0; i < 5; i += 1) rerender(makeManagers());
        expect(result.current).toBe(first);
        for (const name of SLICE_NAMES) {
            expect(SLICE_OF[name](result.current)).toBe(SLICE_OF[name](first));
        }
    });

    it("an unrelated member changing moves no slice", () => {
        const { result, rerender } = render(makeManagers());
        const first = result.current;
        const next = makeManagers();
        for (const m of Object.keys(next) as ManagerName[]) next[m].notInAnySlice = 1;
        rerender(next);
        expect(result.current).toBe(first);
    });

    // Every picked VALUE of every slice: a change moves that slice (and the bundle),
    // and moves no slice that does not carry it.
    const valueCases = SLICE_NAMES.flatMap((name) =>
        SIDEBAR_SLICE_SPECS[name].values.map((key) => [name, key] as [SliceName, string])
    );
    it.each(valueCases)(
        "slice %s changes when its value %s changes, and only the slices that carry it",
        (name, key) => {
            const { result, rerender } = render(makeManagers());
            const before = result.current;
            const next = makeManagers();
            const m = MANAGER_OF[name];
            next[m][key] = { token: "changed" };
            rerender(next);

            expect(result.current).not.toBe(before);
            expect(SLICE_OF[name](result.current)).not.toBe(SLICE_OF[name](before));
            for (const other of SLICE_NAMES) {
                if (other === name) continue;
                const spec = SIDEBAR_SLICE_SPECS[other];
                const carries =
                    MANAGER_OF[other] === m &&
                    ([...spec.values, ...spec.latest] as string[]).includes(key);
                if (carries) {
                    expect(SLICE_OF[other](result.current)).not.toBe(SLICE_OF[other](before));
                } else {
                    expect(SLICE_OF[other](result.current)).toBe(SLICE_OF[other](before));
                }
            }
        }
    );

    // Every picked FUNCTION that the manager recreates on each render: a new
    // implementation moves nothing, and the wrapper calls it.
    const latestCases = SLICE_NAMES.flatMap((name) =>
        SIDEBAR_SLICE_SPECS[name].latest.map((key) => [name, key] as [SliceName, string])
    );
    it.each(latestCases)(
        "slice %s keeps its identity when %s is replaced, and calls the new one",
        (name, key) => {
            const { result, rerender } = render(makeManagers());
            const before = result.current;
            const slice = SLICE_OF[name](before) as Record<string, (...a: unknown[]) => unknown>;
            const wrapper = slice[key];

            const m = MANAGER_OF[name];
            const next = makeManagers();
            const newest = vi.fn(() => "newest");
            next[m][key] = newest;
            rerender(next);

            expect(result.current).toBe(before);
            expect((SLICE_OF[name](result.current) as Record<string, unknown>)[key]).toBe(wrapper);
            expect(wrapper("x")).toBe("newest");
            expect(newest).toHaveBeenCalledWith("x");
        }
    );

    it("a stable wrapper is shared by every slice of a manager that carries the same function", () => {
        // Each slice owns its wrapper, but all of them reach the same newest function.
        const { result, rerender } = render(makeManagers());
        const next = makeManagers();
        const newest = vi.fn(() => "newest");
        next.useTM.closeTaskPreview = newest;
        rerender(next);
        const tree = result.current.tree.tm as unknown as Record<string, () => unknown>;
        expect(tree.closeTaskPreview()).toBe("newest");
        expect(newest).toHaveBeenCalledTimes(1);
    });

    it("the project / milestone tree is not handed the open task id, the tag revision or a view flag", () => {
        const treeKeys = [
            ...SIDEBAR_SLICE_SPECS.treeTM.values,
            ...SIDEBAR_SLICE_SPECS.treeTM.latest,
        ] as string[];
        for (const key of [
            "currentPreviewTaskId",
            "tagsRevision",
            "isTaskTableVisible",
            "isTaskDashboardVisible",
            "isSprintBoardVisible",
            "setCurrentPreviewTaskId",
        ]) {
            expect(treeKeys).not.toContain(key);
        }
    });

    it("no member is listed both as a value and as a latest function", () => {
        for (const name of SLICE_NAMES) {
            const spec = SIDEBAR_SLICE_SPECS[name];
            const values = spec.values as readonly string[];
            for (const key of spec.latest as readonly string[]) {
                expect(values).not.toContain(key);
            }
        }
    });
});
