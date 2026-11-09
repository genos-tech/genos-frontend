/**
 * MIP-1351 / MIP-1362. `lastProgressAt` is when a task, or anything under it,
 * last had real progress. It differs from `updatedAt` exactly when a CHILD
 * changed, so every place that decides "is this row the same as the one I
 * have?" or "does this card say anything new?" has to look at it.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AvatarContextProvider } from "../components/ui/avatars/AvatarContext";
import { AssignedMilestoneCard } from "../features/tasks/components/dashboard/AssignedMilestoneCard";
import { defaultColumns } from "../features/tasks/components/table/DraggableTaskTable";
import { Milestone } from "../features/tasks/sprint-milestone/types";
import { mergeProjectRows } from "../features/tasks/utils/mergeProjectRows";
import { formatRelativeAge, parseServerTime } from "../features/tasks/utils/relativeAge";
import { buildTierComparator, SORT_FIELD_OPTIONS } from "../features/tasks/utils/sortTask";
import { en } from "../i18n/locales/en";
import { UserProps } from "../types/admin";
import { TaskTableProps } from "../types/tasks";

const row = (id: number, over: Partial<TaskTableProps> = {}): TaskTableProps =>
    ({
        id: String(id),
        updatedAt: "2026-11-09 07:00:00+00:00",
        lastProgressAt: null,
        ...over,
    }) as unknown as TaskTableProps;

const NOW = Date.parse("2026-11-09T12:00:00.000Z");
const msg = en.tasks.activity;

describe("parseServerTime", () => {
    it.each([
        [
            "server form",
            "2026-11-09 07:35:50.694921+00:00",
            Date.parse("2026-11-09T07:35:50.694Z"),
        ],
        ["ISO", "2026-11-09T07:35:50.694921Z", Date.parse("2026-11-09T07:35:50.694Z")],
        ["an offset", "2026-11-09 16:35:50+09:00", Date.parse("2026-11-09T07:35:50.000Z")],
        ["no fraction", "2026-11-09 07:35:50+00:00", Date.parse("2026-11-09T07:35:50.000Z")],
    ])("reads %s", (_name, value, expected) => {
        expect(parseServerTime(value)).toBe(expected);
    });

    it("reads the app's zone-less form as local time", () => {
        expect(parseServerTime("2026-11-09 07:35:50")).toBe(
            new Date(2026, 10, 9, 7, 35, 50).getTime()
        );
    });

    it.each([null, undefined, "", "yesterday", 5, "2026-13-45 99:99:99"])(
        "is null for %p",
        (value) => {
            expect(parseServerTime(value)).toBeNull();
        }
    );
});

describe("formatRelativeAge", () => {
    const ago = (ms: number) => new Date(NOW - ms).toISOString();

    it.each([
        [30_000, "just now"],
        [60_000, "1 minute ago"],
        [5 * 60_000, "5 minutes ago"],
        [60 * 60_000, "1 hour ago"],
        [3 * 3_600_000, "3 hours ago"],
        [24 * 3_600_000, "1 day ago"],
        [3 * 24 * 3_600_000, "3 days ago"],
    ])("%i ms ago reads %s", (ms, expected) => {
        expect(formatRelativeAge(ago(ms), msg, NOW)).toBe(expected);
    });

    it("gives a date from a week on", () => {
        expect(formatRelativeAge(ago(10 * 24 * 3_600_000), msg, NOW)).toMatch(/2026/);
    });

    it("is empty for nothing recorded", () => {
        expect(formatRelativeAge(null, msg, NOW)).toBe("");
        expect(formatRelativeAge("not a time", msg, NOW)).toBe("");
    });
});

describe("mergeProjectRows and lastProgressAt", () => {
    it("takes the new row when only lastProgressAt moved (a child changed, the parent's updatedAt did not)", () => {
        const prev = [row(1, { lastProgressAt: "2026-11-01 00:00:00+00:00" })];
        const next = [row(1, { lastProgressAt: "2026-11-09 06:00:00+00:00" })];
        const merged = mergeProjectRows(prev, next);
        expect(merged).not.toBe(prev);
        expect(merged[0]).toBe(next[0]);
    });

    it("a row whose value is null and one without the key are the same", () => {
        const a = row(1, { lastProgressAt: null });
        const { lastProgressAt: _drop, ...bare } = row(1);
        expect(mergeProjectRows([a], [bare as TaskTableProps])).toEqual([a]);
    });

    it("keeps the very same objects when neither moved", () => {
        const prev = [row(1, { lastProgressAt: "2026-11-09 06:00:00+00:00" }), row(2)];
        const merged = mergeProjectRows(prev, [
            row(1, { lastProgressAt: "2026-11-09 06:00:00+00:00" }),
            row(2),
        ]);
        expect(merged).toBe(prev);
    });

    it("re-renders only the row that moved", () => {
        const prev = [row(1), row(2, { lastProgressAt: "2026-11-01 00:00:00+00:00" })];
        const next = [row(1), row(2, { lastProgressAt: "2026-11-09 06:00:00+00:00" })];
        const merged = mergeProjectRows(prev, next);
        expect(merged[0]).toBe(prev[0]);
        expect(merged[1]).toBe(next[1]);
    });
});

describe("sorting and the column", () => {
    it("sorts by lastProgressAt, newest first, with rows that have none last in either direction", () => {
        for (const direction of ["asc", "desc"] as const) {
            const cmp = buildTierComparator([{ field: "lastProgressAt", direction }]);
            expect(
                cmp(
                    row(1, { lastProgressAt: null }),
                    row(2, { lastProgressAt: "2026-11-01 00:00:00+00:00" })
                )
            ).toBeGreaterThan(0);
        }
        const desc = buildTierComparator([{ field: "lastProgressAt", direction: "desc" }]);
        const rows = [
            row(1, { lastProgressAt: "2026-11-01 00:00:00+00:00" }),
            row(2, { lastProgressAt: "2026-11-09 00:00:00+00:00" }),
        ].sort(desc);
        expect(rows.map((r) => r.id)).toEqual(["2", "1"]);
    });

    it("compares the instants, not the strings (the server form has a space where ISO has a T)", () => {
        const desc = buildTierComparator([{ field: "lastProgressAt", direction: "desc" }]);
        // As strings "...T05..." sorts after "... 06...", but 06:00Z is the later time.
        const later = row(1, { lastProgressAt: "2026-11-09 06:00:00+00:00" });
        const earlier = row(2, { lastProgressAt: "2026-11-09T05:00:00Z" });
        expect([earlier, later].sort(desc).map((r) => r.id)).toEqual(["1", "2"]);
    });

    it("is a sort choice, and every label key exists in English", () => {
        const option = SORT_FIELD_OPTIONS.find((o) => o.value === "lastProgressAt");
        expect(option).toBeDefined();
        for (const o of SORT_FIELD_OPTIONS) {
            expect(en.tasks.table.columns[o.labelKey], o.value).toBeTruthy();
        }
    });

    it("is a table column with a label, visible by default", () => {
        const col = defaultColumns.find((c) => c.field === "lastProgressAt");
        expect(col).toBeDefined();
        expect(col?.hidden).toBeFalsy();
        expect(en.tasks.table.columns.lastProgressAt).toBe("Last Progress");
    });
});

const milestone = (over: Partial<Milestone> = {}): Milestone =>
    ({
        milestoneId: 7,
        taskId: 70,
        displayId: "MIP-70",
        projectId: 1,
        teamId: 1,
        sprintId: null,
        title: "Launch week",
        status: "WIP",
        statusCode: 1,
        priority: "Normal",
        priorityCode: null,
        startDate: null,
        dueDate: null,
        tags: [],
        assignees: [],
        tasksTotal: 4,
        tasksClosed: 1,
        ...over,
    }) as unknown as Milestone;

const renderCard = (m: Milestone) =>
    render(
        <AvatarContextProvider
            value={{
                myself: { userId: "me", userName: "Me" } as unknown as UserProps,
                setMyself: () => {},
                teamMemberProfiles: {},
                setTeamMemberProfiles: () => {},
                socket: null,
                useCM: {} as never,
                useUISM: {} as never,
            }}
        >
            <CssVarsProvider>
                <AssignedMilestoneCard milestone={m} sprintName={null} onOpen={() => {}} />
            </CssVarsProvider>
        </AvatarContextProvider>
    );

describe("the milestone card", () => {
    it("says when the milestone last had progress", () => {
        renderCard(
            milestone({ lastProgressAt: new Date(Date.now() - 3 * 86_400_000).toISOString() })
        );
        expect(screen.getByTestId("milestone-card-last-progress").textContent).toBe(
            "Last progress 3 days ago"
        );
    });

    it("says nothing when the server has recorded none", () => {
        renderCard(milestone({ lastProgressAt: null }));
        expect(screen.queryByTestId("milestone-card-last-progress")).toBeNull();
    });
});
