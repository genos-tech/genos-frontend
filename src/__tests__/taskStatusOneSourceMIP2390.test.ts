/**
 * MIP-2390 (phase 0 of custom statuses, MIP-1467): the list of task statuses lives in ONE module,
 * `features/tasks/meta/taskStatuses.ts`. This test fails when a new hard-coded copy of the list
 * appears in a source file, so adding a status (or a project's own statuses, later) never means
 * hunting for copies again.
 *
 * What counts as a copy: four or more of the six status names written as string literals within
 * 8 lines of each other. A file that must keep one (a per-status table of icons, the board's
 * column definitions, a test fixture) is named in `ALLOWED` with the reason; shrink that list,
 * never grow it without a reason.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { REPORT_STATUSES } from "../features/inbox/utils/genosReportV2";
import { activeWorkRank } from "../features/tasks/diagram/utils/layoutOptions";
import {
    ACTIVE_STATUS_NAMES,
    buildTaskListGroups,
    DIAGRAM_STATUS_ORDER,
    STATUS_NAMES,
    STATUS_RANK,
    WORKFLOW_STATUS_NAMES,
} from "../features/tasks/meta/taskStatuses";
import {
    ACTIVE_CHILD_STATUSES,
    HIDDEN_CHILD_STATUSES,
} from "../features/tasks/services/childTaskStatuses";
import {
    MILESTONE_LIST_STATUSES,
    MILESTONE_STATUS_ORDER,
} from "../features/tasks/sprint-milestone/utils/sortMilestones";
import { taskTypes } from "../features/tasks/types/TaskTableTypes";
import { MILESTONE_PROGRESS_ORDER } from "../features/tasks/utils/milestoneTaskProgress";
import { ACTIVE_STATUSES, SERVER_STATUS_LABELS } from "../features/tasks/utils/projectStatusScope";

const srcDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** Files that legitimately spell several statuses out, and why. */
const ALLOWED: Record<string, string> = {
    "features/tasks/meta/taskStatuses.ts": "the source",
    // Per-status CODE (one branch, count field, icon or sample per status), not a list: each
    // needs a per-status edit when a status is added, and phase 1 (MIP-1467) reworks them.
    "features/designSystem/TaskCardSamples.tsx": "one sample card per status",
    "features/spotlight/types.ts": "a comment naming the statuses",
    "features/tasks/components/dashboard/tabs/OverallTab.tsx": "one stat per status",
    "features/tasks/components/dashboard/tabs/TeamLoadCard.tsx": "one stat per status",
    "features/tasks/components/dashboard/useTaskHomeData.ts": "one count per status",
    "features/tasks/utils/dashboardStats.ts": "one count per status",
    "features/tasks/components/meta/statusIcons.tsx": "one icon per status",
    "features/tasks/sprint-milestone/types.ts": "the MilestoneStatus type",
    "i18n/locales/en/tasks.ts": "translation keys, English",
    "i18n/locales/ja/index.ts": "translation keys, Japanese",
    // Not caught by the detector (each status sits in its own 8+ line block), listed so the next
    // person finds them: the board's fixed COLUMNS (sprintBoardHelpers.ts), bucket keys
    // (sprintBoardDisplay.ts, SprintBoard.tsx), the per-status icon table in
    // DraggableTaskTable.tsx (open PR #1371 edits it: fold it in after it merges) and the preset
    // filters in TaskTableTypes.ts.
};

const NAMES = ["Open", "WIP", "Blocked", "Pending", "Closed", "Deleted"];
const LITERAL = new RegExp(`["'\`](${NAMES.join("|")})["'\`]`, "g");
const WINDOW = 8;
const THRESHOLD = 4;

const walk = (dir: string, out: string[] = []): string[] => {
    for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) {
            if (name === "__tests__" || name === "node_modules") continue;
            walk(p, out);
        } else if (/\.(ts|tsx)$/.test(name) && !/\.(test|spec)\.(ts|tsx)$/.test(name)) {
            out.push(p);
        }
    }
    return out;
};

/** The first line where `THRESHOLD` distinct status names sit within `WINDOW` lines, or null. */
const copyAt = (text: string): number | null => {
    const hits: { line: number; name: string }[] = [];
    text.split("\n").forEach((line, i) => {
        for (const m of line.matchAll(LITERAL)) hits.push({ line: i + 1, name: m[1] });
    });
    for (let i = 0; i < hits.length; i++) {
        const seen = new Set<string>();
        for (let j = i; j < hits.length && hits[j].line - hits[i].line < WINDOW; j++) {
            seen.add(hits[j].name);
        }
        if (seen.size >= THRESHOLD) return hits[i].line;
    }
    return null;
};

describe("task statuses have one source (MIP-2390)", () => {
    it("no source file outside the module spells the status list out again", () => {
        const offenders = walk(srcDir)
            .map((f) => relative(srcDir, f))
            .filter((f) => !(f in ALLOWED))
            .flatMap((f) => {
                const line = copyAt(readFileSync(join(srcDir, f), "utf8"));
                return line === null ? [] : [`${f}:${line}`];
            });
        expect(
            offenders,
            "import the list from features/tasks/meta/taskStatuses.ts instead of typing it"
        ).toEqual([]);
    });

    it("the detector sees a copy (guards the guard)", () => {
        expect(copyAt('const x = ["Open", "WIP", "Blocked", "Pending"];')).toBe(1);
        expect(copyAt('if (a === "Closed" || b === "Open") {}')).toBeNull();
    });

    it("every allowed file still needs its exception", () => {
        const stale = Object.keys(ALLOWED).filter(
            (f) =>
                f !== "features/tasks/meta/taskStatuses.ts" &&
                copyAt(readFileSync(join(srcDir, f), "utf8")) === null
        );
        expect(stale, "remove it from ALLOWED").toEqual([]);
    });
});

describe("the copies read the module and hold the values they always held", () => {
    it("the lists", () => {
        expect([...STATUS_NAMES]).toEqual([
            "Open",
            "WIP",
            "Blocked",
            "Pending",
            "Closed",
            "Deleted",
        ]);
        expect([...ACTIVE_STATUS_NAMES]).toEqual(["Open", "WIP", "Blocked", "Pending"]);
        expect([...WORKFLOW_STATUS_NAMES]).toEqual([
            "Open",
            "WIP",
            "Blocked",
            "Pending",
            "Closed",
        ]);
        expect([...SERVER_STATUS_LABELS]).toEqual([...STATUS_NAMES]);
        expect([...ACTIVE_STATUSES]).toEqual([...ACTIVE_STATUS_NAMES]);
        expect([...ACTIVE_CHILD_STATUSES]).toEqual([...ACTIVE_STATUS_NAMES]);
        expect([...HIDDEN_CHILD_STATUSES]).toEqual(["Closed", "Deleted"]);
        expect([...MILESTONE_STATUS_ORDER]).toEqual([...WORKFLOW_STATUS_NAMES]);
        expect([...MILESTONE_LIST_STATUSES]).toEqual([...WORKFLOW_STATUS_NAMES]);
        expect([...MILESTONE_PROGRESS_ORDER]).toEqual([...WORKFLOW_STATUS_NAMES]);
        expect([...REPORT_STATUSES]).toEqual([...WORKFLOW_STATUS_NAMES]);
    });

    it("the table sort rank", () => {
        expect(STATUS_RANK).toEqual({
            Open: 1,
            WIP: 2,
            Blocked: 3,
            Pending: 4,
            Closed: 5,
            Deleted: 6,
        });
    });

    it("the diagram order: active work first, the rest last", () => {
        expect([...DIAGRAM_STATUS_ORDER]).toEqual(["WIP", "Blocked", "Open", "Pending"]);
        expect(activeWorkRank("WIP", "Critical")).toBeLessThan(
            activeWorkRank("Blocked", "Critical")
        );
        expect(activeWorkRank("Closed", null)).toBe(activeWorkRank("In Review", null));
    });

    it("the All / Ongoing / Closed / Deleted lists, as separate copies", () => {
        expect(taskTypes).toEqual({
            all: { id: 0, statuses: [...STATUS_NAMES], name: "All" },
            ongoing: { id: 1, statuses: [...ACTIVE_STATUS_NAMES], name: "Ongoing" },
            closed: { id: 2, statuses: ["Closed"], name: "Closed" },
            deleted: { id: 3, statuses: ["Deleted"], name: "Deleted" },
        });
        const a = buildTaskListGroups();
        a.all.statuses.push("X");
        expect(buildTaskListGroups().all.statuses).toHaveLength(6);
    });
});
