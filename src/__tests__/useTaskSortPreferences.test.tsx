import { ReactNode } from "react";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import {
    tableSortOverrideFor,
    TaskSortPreferencesProvider,
    useTaskSortPreferences,
} from "../hooks/common/useTaskSortPreferences";

const wrapper = ({ children }: { children: ReactNode }) => (
    <TaskSortPreferencesProvider>{children}</TaskSortPreferencesProvider>
);

describe("useTaskSortPreferences", () => {
    beforeEach(() => {
        window.localStorage.clear();
    });

    // The table's `sortTasks` / `childrenByParent` memos key off the
    // *identity* of the tiers array. If a setter ever returned the same
    // reference (or mutated in place), the modal would update its own
    // selects while the table quietly kept the previous order — the
    // "sort isn't applied" bug in a new form. These two cases pin the
    // reactive link that the pure comparator tests can't see.
    it("hands out a new array identity on change so downstream memos re-run", () => {
        const { result } = renderHook(() => useTaskSortPreferences(), { wrapper });
        const before = result.current.tableSortTiers;

        act(() => {
            result.current.setTableSortTiers([{ field: "dueDate", direction: "asc" }]);
        });

        expect(result.current.tableSortTiers).not.toBe(before);
        expect(result.current.tableSortTiers).toEqual([{ field: "dueDate", direction: "asc" }]);
    });

    it("does the same for the sprint board tiers", () => {
        const { result } = renderHook(() => useTaskSortPreferences(), { wrapper });
        const before = result.current.sprintBoardSortTiers;

        act(() => {
            result.current.setSprintBoardSortTiers([{ field: "priority", direction: "desc" }]);
        });

        expect(result.current.sprintBoardSortTiers).not.toBe(before);
        expect(result.current.sprintBoardSortTiers).toEqual([
            { field: "priority", direction: "desc" },
        ]);
    });

    it("defaults the table to priority desc and the board to no sort", () => {
        const { result } = renderHook(() => useTaskSortPreferences(), { wrapper });
        expect(result.current.tableSortTiers).toEqual([{ field: "priority", direction: "desc" }]);
        expect(result.current.sprintBoardSortTiers).toEqual([]);
    });

    it("persists a change and restores it on the next mount", () => {
        const first = renderHook(() => useTaskSortPreferences(), { wrapper });
        act(() => {
            first.result.current.setTableSortTiers([
                { field: "status", direction: "asc" },
                { field: "title", direction: "desc" },
            ]);
        });
        first.unmount();

        const second = renderHook(() => useTaskSortPreferences(), { wrapper });
        expect(second.result.current.tableSortTiers).toEqual([
            { field: "status", direction: "asc" },
            { field: "title", direction: "desc" },
        ]);
    });

    it("keeps a user-set empty table sort instead of snapping back to the default", () => {
        const first = renderHook(() => useTaskSortPreferences(), { wrapper });
        act(() => {
            first.result.current.setTableSortTiers([]);
        });
        first.unmount();

        const second = renderHook(() => useTaskSortPreferences(), { wrapper });
        expect(second.result.current.tableSortTiers).toEqual([]);
    });

    it("falls back to the default table sort when the stored blob is corrupt", () => {
        window.localStorage.setItem("genos.taskTable.sortTiers.v2", "{not json");
        const { result } = renderHook(() => useTaskSortPreferences(), { wrapper });
        expect(result.current.tableSortTiers).toEqual([{ field: "priority", direction: "desc" }]);
    });

    it("drops duplicate fields and clamps to two tiers", () => {
        const { result } = renderHook(() => useTaskSortPreferences(), { wrapper });
        act(() => {
            result.current.setTableSortTiers([
                { field: "priority", direction: "desc" },
                { field: "priority", direction: "asc" },
                { field: "title", direction: "asc" },
                { field: "dueDate", direction: "asc" },
            ]);
        });
        expect(result.current.tableSortTiers).toEqual([
            { field: "priority", direction: "desc" },
            { field: "title", direction: "asc" },
        ]);
    });

    describe("temporary table sort override (header click)", () => {
        const OVERRIDE = [{ field: "title", direction: "asc" }] as const;

        it("never touches storage or the saved sort", () => {
            const { result } = renderHook(() => useTaskSortPreferences(), { wrapper });
            act(() => {
                result.current.setTableSortOverride([...OVERRIDE], 7);
            });
            expect(result.current.tableSortOverride?.tiers).toEqual(OVERRIDE);
            expect(result.current.tableSortTiers).toEqual([
                { field: "priority", direction: "desc" },
            ]);
            expect(window.localStorage.getItem("genos.taskTable.sortTiers.v2")).toBeNull();
        });

        it("keeps a previously saved sort in storage untouched", () => {
            const saved = [{ field: "status", direction: "asc" }];
            window.localStorage.setItem("genos.taskTable.sortTiers.v2", JSON.stringify(saved));
            const { result } = renderHook(() => useTaskSortPreferences(), { wrapper });
            act(() => {
                result.current.setTableSortOverride([...OVERRIDE], 7);
            });
            expect(
                JSON.parse(window.localStorage.getItem("genos.taskTable.sortTiers.v2")!)
            ).toEqual(saved);
            expect(result.current.tableSortTiers).toEqual(saved);
        });

        it("is cleared when the modal saves a table sort", () => {
            const { result } = renderHook(() => useTaskSortPreferences(), { wrapper });
            act(() => {
                result.current.setTableSortOverride([...OVERRIDE], 7);
            });
            act(() => {
                result.current.setTableSortTiers([{ field: "dueDate", direction: "desc" }]);
            });
            expect(result.current.tableSortOverride).toBeNull();
        });

        it("is not cleared by a sprint board save", () => {
            const { result } = renderHook(() => useTaskSortPreferences(), { wrapper });
            act(() => {
                result.current.setTableSortOverride([...OVERRIDE], 7);
            });
            act(() => {
                result.current.setSprintBoardSortTiers([{ field: "priority", direction: "asc" }]);
            });
            expect(result.current.tableSortOverride?.tiers).toEqual(OVERRIDE);
        });

        it("can be cleared with null", () => {
            const { result } = renderHook(() => useTaskSortPreferences(), { wrapper });
            act(() => {
                result.current.setTableSortOverride([...OVERRIDE], 7);
            });
            act(() => {
                result.current.setTableSortOverride(null, 7);
            });
            expect(result.current.tableSortOverride).toBeNull();
        });

        it("does not survive a reload (new mount returns to the saved sort)", () => {
            const first = renderHook(() => useTaskSortPreferences(), { wrapper });
            act(() => {
                first.result.current.setTableSortOverride([...OVERRIDE], 7);
            });
            first.unmount();
            const second = renderHook(() => useTaskSortPreferences(), { wrapper });
            expect(second.result.current.tableSortOverride).toBeNull();
        });

        it("only applies to the project it was made in", () => {
            const { result } = renderHook(() => useTaskSortPreferences(), { wrapper });
            act(() => {
                result.current.setTableSortOverride([...OVERRIDE], 7);
            });
            const o = result.current.tableSortOverride;
            expect(tableSortOverrideFor(o, 7)).toEqual(OVERRIDE);
            expect(tableSortOverrideFor(o, 8)).toBeNull();
            expect(tableSortOverrideFor(o, null)).toBeNull();
            expect(tableSortOverrideFor(null, 7)).toBeNull();
        });
    });
});
