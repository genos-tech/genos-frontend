/**
 * MIP-1122: every status / priority palette in the app is a view of ONE
 * source (features/tasks/meta/taskTone.ts).
 *
 * The bug this prevents: the same status was a different color depending on
 * where you looked (Pending: purple in the table, orange on the dashboard,
 * purple again on milestones). Each assertion below is "this place agrees
 * with the source", so adding an eighth palette, or editing one in place,
 * fails here.
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { STATUS_COLORS } from "../features/tasks/components/TaskStatusChip";
import {
    PRIORITY_NAMES,
    prioritySolid,
    STATUS_FILL,
    STATUS_NAMES,
    STATUS_TONE,
    statusSolid,
    toneBase,
    toneSoftBg,
} from "../features/tasks/meta/taskTone";
import { MILESTONE_STATUS_CHIP_COLORS } from "../features/tasks/sprint-milestone/utils/sortMilestones";
import {
    predefinedPriorityFilters,
    predefinedStatusFilters,
} from "../features/tasks/types/TaskTableTypes";
import { taskMessageTemplate } from "../features/tasks/utils/TaskMessageTemplate";
import { priorities, statuses } from "../features/tasks/utils/taskMeta";
import { UserProps } from "../types/admin";
import { TaskProps } from "../types/tasks";

// Not `new URL(…, import.meta.url)`: Vite rewrites that form as an asset import.
const srcDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p: string) => readFileSync(resolve(srcDir, p), "utf8");

const byLabel = <T extends { label: string }>(list: T[], label: string) =>
    list.find((f) => f.label === label)!;

describe("taskMeta arrays are the tone source", () => {
    it.each(STATUS_NAMES)("status %s", (name) => {
        const s = statuses.find((x) => x.status === name)!;
        expect({ color: s.color, textColor: s.textColor }).toEqual(statusSolid(name));
    });

    it.each(PRIORITY_NAMES)("priority %s", (name) => {
        const p = priorities.find((x) => x.priority === name)!;
        expect({ color: p.color, textColor: p.textColor }).toEqual(prioritySolid(name));
    });
});

describe("every other palette agrees with it", () => {
    it.each(STATUS_NAMES)("%s: milestone chip colors, STATUS_FILL", (name) => {
        const solid = statusSolid(name);
        expect(MILESTONE_STATUS_CHIP_COLORS[name]).toEqual(solid);
        expect(STATUS_FILL[name]).toBe(solid.color);
    });

    it.each(["Open", "WIP", "Blocked", "Pending", "Closed"] as const)(
        "%s: the dashboard's soft swatch",
        (name) => {
            const tone = STATUS_TONE[name];
            expect(STATUS_COLORS[name].text).toBe(toneBase(tone));
            expect(STATUS_COLORS[name].bg).toBe(toneSoftBg(tone, 0.12));
            // The stat tiles rewrite the alpha by string; that has to keep working.
            expect(STATUS_COLORS[name].bg.replace("0.12", "0.08")).toMatch(/0\.08\)$/);
        }
    );

    it.each(["Open", "WIP", "Blocked", "Pending", "Closed", "Deleted"] as const)(
        "%s: the table's status filter chip",
        (name) => {
            expect(byLabel(predefinedStatusFilters, name).lightModeColor).toBe(
                statusSolid(name).color
            );
        }
    );

    it.each(PRIORITY_NAMES)("%s: the table's priority filter chip", (name) => {
        expect(byLabel(predefinedPriorityFilters, name).lightModeColor).toBe(
            prioritySolid(name).color
        );
    });

    it("an expired (past-due) task is the danger color, like Blocked", () => {
        expect(byLabel(predefinedStatusFilters, "Expired").lightModeColor).toBe(
            statusSolid("Blocked").color
        );
    });

    it("the board's columns and the table's status options too (heavy modules: loaded lazily)", async () => {
        const { COLUMNS } = await import("../features/tasks/components/board/SprintBoard");
        const { statusOptions } = await import(
            "../features/tasks/components/table/DraggableTaskTable"
        );
        for (const c of COLUMNS) {
            expect(c.color, `board column ${c.status}`).toBe(
                statusSolid(c.status as (typeof STATUS_NAMES)[number]).color
            );
        }
        for (const o of statusOptions) {
            expect({ color: o.color, textColor: o.textColor }, `option ${o.value}`).toEqual(
                statusSolid(o.value as (typeof STATUS_NAMES)[number])
            );
        }
    }, 30000);

    it("Pending is ONE color across all of them (it was purple, orange and purple again)", async () => {
        const { COLUMNS } = await import("../features/tasks/components/board/SprintBoard");
        const seen = new Set([
            statuses.find((s) => s.status === "Pending")!.color,
            MILESTONE_STATUS_CHIP_COLORS.Pending.color,
            STATUS_FILL.Pending,
            byLabel(predefinedStatusFilters, "Pending").lightModeColor,
            COLUMNS.find((c) => c.status === "Pending")!.color,
        ]);
        expect([...seen]).toHaveLength(1);
        // and the dashboard's soft swatch is the same hue family (neutral gray), not orange
        expect(STATUS_COLORS.Pending.text).toBe(toneBase("neutral"));
    }, 30000);
});

describe("chat task messages keep their colors", () => {
    // taskMessageTemplate once looked colors up by status HEX. When the colors
    // moved onto the tokens that lookup would have silently returned "default"
    // for every status and priority. It keys by tone now.
    const user = {
        userId: "u1",
        userName: "Ken",
        userEmail: "k@x.dev",
        teamId: "t1",
    } as UserProps;
    const chips = (status: string, priority: string) => {
        const blocks = taskMessageTemplate(user, {
            title: "T",
            status: { status },
            priority: { priority },
            effortLevel: { level: "Low" },
            assignee: null,
            reporter: user,
            dueDate: null,
        } as unknown as TaskProps) as Array<{
            content: Array<{ text?: string; styles?: { textColor?: string } }>;
        }>;
        const find = (text: string) =>
            blocks.flatMap((b) => b.content).find((n) => n.text === text)?.styles?.textColor;
        return { status: find(status), priority: find(priority) };
    };

    it.each([
        ["Open", "blue"],
        ["WIP", "orange"],
        ["Blocked", "red"],
        ["Pending", "gray"],
        ["Closed", "green"],
    ])("status %s is %s", (status, color) => {
        expect(chips(status, "Normal").status).toBe(color);
    });

    it.each([
        ["Minimal", "gray"],
        ["Low", "gray"],
        ["Normal", "blue"],
        ["High", "orange"],
        ["Critical", "red"],
    ])("priority %s is %s", (priority, color) => {
        expect(chips("Open", priority).priority).toBe(color);
    });
});

describe("an expired (past-due) task", () => {
    it("is drawn in the danger tone in the row too, not Deleted's gray", () => {
        // It was a hard-coded red; mapping that hex to "Deleted" made it gray
        // with white text. The row and the filter chip must agree.
        const code = read("features/tasks/components/table/DraggableTaskRow.tsx");
        const chip = code.slice(code.indexOf("t.tasks.filters.expired"));
        expect(chip.slice(0, 600)).toContain('toneSolid("danger")');
        expect(chip.slice(0, 600)).not.toContain('statusSolid("Deleted")');
    });
});

describe("the migrated files do not re-declare the old status hexes", () => {
    const OLD = ["#0044c2", "#ff8c00", "#e11d48", "#b900ff", "#1dc200", "#ff2323"];
    const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

    it.each([
        "features/tasks/utils/taskMeta.ts",
        "features/tasks/components/TaskStatusChip.tsx",
        "features/tasks/components/TaskIdentityRow.tsx",
        "features/tasks/components/sidebar/SearchBox.tsx",
        "features/tasks/components/contents/CreateTaskForm.tsx",
        "features/tasks/components/contents/TaskPreview.tsx",
        "features/tasks/components/board/SprintBoard.tsx",
        "features/tasks/components/table/DraggableTaskTable.tsx",
        "features/tasks/components/table/DraggableTaskRow.tsx",
        "features/tasks/sprint-milestone/utils/sortMilestones.ts",
        "features/tasks/sprint-milestone/components/SprintManagerDialog.tsx",
        "features/tasks/sprint-milestone/components/SprintMilestonesSection.tsx",
        "features/tasks/utils/TaskMessageTemplate.ts",
        "components/layout/HistoryModal.tsx",
    ])("%s", (file) => {
        const code = strip(read(file)).toLowerCase();
        for (const hex of OLD) expect(code, `${file} still has ${hex}`).not.toContain(hex);
    });

    it("TaskTableTypes: the status and priority filter arrays (effort levels still own theirs)", () => {
        const code = strip(read("features/tasks/types/TaskTableTypes.ts"));
        const region = code.slice(
            code.indexOf("export const predefinedStatusFilters"),
            code.indexOf("export const predefinedEffortLevelFilters")
        );
        expect(region).toContain("filterColors(");
        expect(region).not.toMatch(/lightModeColor:\s*"#/);
    });
});
