/**
 * Guards the task-table row's memo comparator — specifically, that the
 * cost of opening a task does NOT scale with the number of rows on screen.
 *
 * The comparator used to hold values that are global to the table:
 * `useTM.currentPreview{TaskId,MilestoneId,Kind}`, `isTaskPreviewVisible`,
 * the parent's `pendingTaskId` / `pendingMilestoneId`, and the shared
 * `childrenByParent` Map. Every one of those changes when the user opens a
 * task, so every row failed equality and re-rendered — and a single click
 * flips them more than once (pending set → debounced real setter → pending
 * clear), so an N-row table paid N heavy row renders several times per
 * click. That was the table's half of the task-switch jank, and it got
 * worse as projects accumulated tasks.
 *
 * The fix resolves them in the parent into two per-row booleans. These
 * tests pin the resulting invariant from both sides:
 *
 *   - too LOOSE (a rendered field not compared) → a silently stale row:
 *     a highlight that never moves, a missing expand chevron;
 *   - too STRICT (a table-global value compared) → the O(N) regression
 *     this change exists to remove.
 */

import { describe, expect, it } from "vitest";

import {
    draggableTaskRowPropsAreEqual,
    type DraggableTaskRowProps,
} from "../features/tasks/components/table/DraggableTaskRow";
import type { TaskManagementState } from "../hooks/tasks/useTaskManagement";
import type { UserProps } from "../types/admin";
import type { TaskTableProps } from "../types/tasks";

const TASK = { id: "42", title: "Some task", isMilestone: false } as unknown as TaskTableProps;
const COLUMNS = [] as unknown as DraggableTaskRowProps["columns"];
const TEAM_MEMBERS = [] as unknown as UserProps[];
const PROJECT_TAGS = [] as unknown as DraggableTaskRowProps["projectTags"];
const EXPANDED = new Set<string>();
const SPRINT_NAMES = new Map<number, string>();
const MYSELF = { userId: "u1" } as unknown as UserProps;

// Rebuilt fresh on every call, exactly like `useTaskManagement` does on
// each state write — a row must never be invalidated by that alone.
const freshUseTM = (over: Partial<Record<string, unknown>> = {}): TaskManagementState =>
    ({
        isTaskPreviewVisible: true,
        currentPreviewKind: "task",
        currentPreviewTaskId: 7,
        currentPreviewMilestoneId: -1,
        ...over,
    }) as unknown as TaskManagementState;

const baseProps = (over: Partial<DraggableTaskRowProps> = {}): DraggableTaskRowProps =>
    ({
        task: TASK,
        index: 0,
        columns: COLUMNS,
        mode: "light",
        depth: 0,
        myself: MYSELF,
        teamMembers: TEAM_MEMBERS,
        expandedRows: EXPANDED,
        hasChildren: false,
        sprintNamesById: SPRINT_NAMES,
        isSelected: false,
        projectTags: PROJECT_TAGS,
        familyKey: "42",
        useTM: freshUseTM(),
        ...over,
    }) as unknown as DraggableTaskRowProps;

describe("draggableTaskRowPropsAreEqual — must-skip (the scalability contract)", () => {
    it("skips when an unrelated row's selection changes", () => {
        // The user opened a different task. `useTM` is a brand-new object
        // carrying a new currentPreviewTaskId, but THIS row was not and is
        // not selected — so it must not re-render. This is the assertion
        // that keeps task-switch cost O(1) instead of O(rows).
        const prev = baseProps({ isSelected: false, useTM: freshUseTM() });
        const next = baseProps({
            isSelected: false,
            useTM: freshUseTM({ currentPreviewTaskId: 999 }),
        });
        expect(draggableTaskRowPropsAreEqual(prev, next)).toBe(true);
    });

    it("skips while a pending click is in flight for another row", () => {
        // Mid-debounce the parent flips selection twice more (pending set,
        // then pending clear). An unrelated row must sit out all of it.
        const prev = baseProps({ isSelected: false });
        const next = baseProps({ isSelected: false });
        expect(draggableTaskRowPropsAreEqual(prev, next)).toBe(true);
    });

    it("skips when the preview pane opens against another task", () => {
        const prev = baseProps({ isSelected: false, useTM: freshUseTM() });
        const next = baseProps({
            isSelected: false,
            useTM: freshUseTM({ isTaskPreviewVisible: false, currentPreviewKind: "milestone" }),
        });
        expect(draggableTaskRowPropsAreEqual(prev, next)).toBe(true);
    });
});

describe("draggableTaskRowPropsAreEqual — must-render (staleness guards)", () => {
    it("re-renders when THIS row becomes selected", () => {
        const prev = baseProps({ isSelected: false });
        const next = baseProps({ isSelected: true });
        expect(draggableTaskRowPropsAreEqual(prev, next)).toBe(false);
    });

    it("re-renders when THIS row becomes deselected", () => {
        const prev = baseProps({ isSelected: true });
        const next = baseProps({ isSelected: false });
        expect(draggableTaskRowPropsAreEqual(prev, next)).toBe(false);
    });

    it("re-renders when the row gains its first child (expand chevron appears)", () => {
        const prev = baseProps({ hasChildren: false });
        const next = baseProps({ hasChildren: true });
        expect(draggableTaskRowPropsAreEqual(prev, next)).toBe(false);
    });

    it("re-renders when the task object itself changes", () => {
        const prev = baseProps();
        const next = baseProps({ task: { ...TASK, title: "Renamed" } as TaskTableProps });
        expect(draggableTaskRowPropsAreEqual(prev, next)).toBe(false);
    });

    it("re-renders when the project's tag options change (inline tags editor)", () => {
        const prev = baseProps({ projectTags: PROJECT_TAGS });
        const next = baseProps({
            projectTags: [
                { tagName: "backend" },
            ] as unknown as DraggableTaskRowProps["projectTags"],
        });
        expect(draggableTaskRowPropsAreEqual(prev, next)).toBe(false);
    });

    it("re-renders when the expanded set changes", () => {
        const prev = baseProps({ expandedRows: EXPANDED });
        const next = baseProps({ expandedRows: new Set(["42"]) });
        expect(draggableTaskRowPropsAreEqual(prev, next)).toBe(false);
    });

    it("re-renders on column resize, reorder or theme change", () => {
        expect(
            draggableTaskRowPropsAreEqual(
                baseProps(),
                baseProps({ columns: [] as unknown as DraggableTaskRowProps["columns"] })
            )
        ).toBe(false);
        expect(draggableTaskRowPropsAreEqual(baseProps(), baseProps({ mode: "dark" }))).toBe(
            false
        );
    });

    it("re-renders when the row moves in the tree", () => {
        expect(draggableTaskRowPropsAreEqual(baseProps(), baseProps({ index: 3 }))).toBe(false);
        expect(draggableTaskRowPropsAreEqual(baseProps(), baseProps({ depth: 1 }))).toBe(false);
    });

    it("re-renders when sprint names resolve", () => {
        const next = baseProps({ sprintNamesById: new Map([[1, "Sprint 1"]]) });
        expect(draggableTaskRowPropsAreEqual(baseProps(), next)).toBe(false);
    });

    it("re-renders when a reparent moves the row to another family", () => {
        // `familyKey` reaches the DOM as the attribute the hover family-focus
        // rules match on. Skipping this render would leave the row grouped
        // with the root it was dragged away from.
        const next = baseProps({ familyKey: "99" });
        expect(draggableTaskRowPropsAreEqual(baseProps(), next)).toBe(false);
    });
});
