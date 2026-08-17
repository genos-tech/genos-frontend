/**
 * `selectVisibleSprints` / `selectEndedSprints` — the two halves of the
 * project's sprint list, and the options the task filter's Sprint dropdown
 * is built from (ongoing inline, ended behind "Show past sprints").
 *
 * The pair is worth pinning down because the split has to be a PARTITION:
 * every non-deleted sprint belongs to exactly one side. A sprint that fell
 * through both would be unselectable in the filter, and one appearing in
 * both would be listed twice with the same key.
 *
 * The ORDERS deliberately disagree, which is the other thing asserted here:
 * ongoing sprints keep the upstream (ascending) order because the next
 * sprint is the interesting one, while ended sprints come back
 * newest-ended-first because the one that just finished is.
 */

import { describe, expect, it } from "vitest";

import type { Sprint } from "../features/tasks/sprint-milestone/types";
import {
    selectEndedSprints,
    selectVisibleSprints,
} from "../features/tasks/sprint-milestone/utils/sortMilestones";

const sprint = (sprintId: number, status: Sprint["status"], over: Partial<Sprint> = {}): Sprint =>
    ({
        sprintId,
        name: `Sprint ${sprintId}`,
        status,
        sequenceNumber: sprintId,
        endDate: null,
        isDeleted: false,
        ...over,
    }) as unknown as Sprint;

describe("selectVisibleSprints", () => {
    it("keeps upcoming and active sprints", () => {
        const out = selectVisibleSprints([sprint(1, "upcoming"), sprint(2, "active")]);
        expect(out.map((s) => s.sprintId)).toEqual([1, 2]);
    });

    it("drops completed and archived sprints", () => {
        expect(selectVisibleSprints([sprint(1, "completed"), sprint(2, "archived")])).toEqual([]);
    });

    it("drops soft-deleted sprints even while active", () => {
        expect(selectVisibleSprints([sprint(1, "active", { isDeleted: true })])).toEqual([]);
    });

    it("preserves the incoming order rather than imposing one", () => {
        // The picker relies on `useSM.projectSprints`' ascending order, so
        // this selector must not reorder — see its docstring.
        const out = selectVisibleSprints([sprint(9, "active"), sprint(3, "upcoming")]);
        expect(out.map((s) => s.sprintId)).toEqual([9, 3]);
    });
});

describe("selectEndedSprints", () => {
    it("keeps completed and archived sprints, newest ended first", () => {
        const out = selectEndedSprints([
            sprint(1, "completed", { endDate: "2026-01-31" }),
            sprint(2, "archived", { endDate: "2026-03-31" }),
            sprint(3, "completed", { endDate: "2026-02-28" }),
        ]);
        expect(out.map((s) => s.sprintId)).toEqual([2, 3, 1]);
    });

    it("drops ongoing sprints", () => {
        expect(selectEndedSprints([sprint(1, "upcoming"), sprint(2, "active")])).toEqual([]);
    });

    it("drops soft-deleted sprints", () => {
        expect(selectEndedSprints([sprint(1, "completed", { isDeleted: true })])).toEqual([]);
    });

    it("falls back to sequenceNumber for undated or unparseable end dates", () => {
        // An ad-hoc sprint created by hand can carry a null or junk end date.
        // It must land somewhere STABLE rather than drift between renders,
        // which a NaN comparison would cause.
        const out = selectEndedSprints([
            sprint(1, "completed", { endDate: null }),
            sprint(3, "completed", { endDate: "not-a-date" }),
            sprint(2, "completed", { endDate: null }),
        ]);
        expect(out.map((s) => s.sprintId)).toEqual([3, 2, 1]);
    });

    it("sorts dated sprints ahead of undated ones", () => {
        const out = selectEndedSprints([
            sprint(1, "completed", { endDate: null }),
            sprint(2, "archived", { endDate: "2020-01-01" }),
        ]);
        expect(out.map((s) => s.sprintId)).toEqual([2, 1]);
    });

    it("does not mutate the caller's array", () => {
        // It sorts, and `Array.prototype.sort` is in-place — so the filter
        // has to come first. `useSM.projectSprints` is shared state; a
        // reorder here would silently reorder the sidebar and the picker.
        const input = [
            sprint(1, "completed", { endDate: "2026-01-31" }),
            sprint(2, "archived", { endDate: "2026-03-31" }),
        ];
        selectEndedSprints(input);
        expect(input.map((s) => s.sprintId)).toEqual([1, 2]);
    });
});

describe("the two selectors partition the sprint list", () => {
    // Every non-deleted sprint must land on exactly one side: a sprint in
    // neither is unreachable in the filter dropdown, and one in both would
    // render twice under the same React key.
    const ALL: Sprint[] = [
        sprint(1, "upcoming"),
        sprint(2, "active"),
        sprint(3, "completed", { endDate: "2026-01-31" }),
        sprint(4, "archived", { endDate: "2026-02-28" }),
    ];

    it("covers every non-deleted sprint exactly once", () => {
        const ids = [...selectVisibleSprints(ALL), ...selectEndedSprints(ALL)].map(
            (s) => s.sprintId
        );
        expect(ids.sort()).toEqual([1, 2, 3, 4]);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it("excludes soft-deleted sprints from both sides", () => {
        const withDeleted = [...ALL, sprint(5, "active", { isDeleted: true })];
        const ids = [...selectVisibleSprints(withDeleted), ...selectEndedSprints(withDeleted)].map(
            (s) => s.sprintId
        );
        expect(ids).not.toContain(5);
    });
});
