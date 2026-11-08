/**
 * MIP-1015: Blocked milestones are loaded and shown as ongoing work.
 *
 * The API moves a milestone to "Blocked" by itself when a dependency blocks
 * it, and `GET /milestone/list/` only returns the statuses it is asked for.
 * Two things are pinned here:
 *
 *   1. No caller of `loadMilestonesForProject` spells its own status list.
 *      Every loader shares `MILESTONE_LIST_STATUSES`, so "Blocked" can't be
 *      left out of one of them again. A source scan, because two of the five
 *      callers (the create form, the sprint manager) have no cheap render
 *      test; the hook and the to-do modal are also checked by behaviour
 *      (`useProjectTaskManagementMilestoneStatuses`, `CreateTaskFromTodo`).
 *   2. The milestone picker lists a Blocked milestone, even one in an ended
 *      sprint, with the danger tone rather than the grey reserved for
 *      unknown statuses.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { CssVarsProvider } from "@mui/joy/styles";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SprintMilestonePicker } from "../features/tasks/sprint-milestone/components/SprintMilestonePicker";
import { MILESTONE_LIST_STATUSES } from "../features/tasks/sprint-milestone/utils/sortMilestones";
import type { SprintMilestoneManagementState } from "../hooks/tasks/useSprintMilestoneManagement";

const SRC = join(process.cwd(), "src");

const sourceFiles = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) return name === "__tests__" ? [] : sourceFiles(full);
        return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [full] : [];
    });

/** The argument text of every `loadMilestonesForProject(...)` call in `text`. */
const callArgs = (text: string): string[] => {
    const out: string[] = [];
    const re = /loadMilestonesForProject\(/g;
    for (let m = re.exec(text); m; m = re.exec(text)) {
        let depth = 1;
        let i = m.index + m[0].length;
        const start = i;
        for (; i < text.length && depth > 0; i++) {
            if (text[i] === "(") depth++;
            else if (text[i] === ")") depth--;
        }
        out.push(text.slice(start, i - 1));
    }
    return out;
};

describe("milestone list loaders", () => {
    it("the shared status list has every live status, Blocked included, and not Deleted", () => {
        expect([...MILESTONE_LIST_STATUSES].sort()).toEqual([
            "Blocked",
            "Closed",
            "Open",
            "Pending",
            "WIP",
        ]);
    });

    it("every caller passes MILESTONE_LIST_STATUSES instead of its own list", () => {
        const calls = sourceFiles(SRC).flatMap((file) =>
            callArgs(readFileSync(file, "utf8")).map((args) => ({
                file: relative(SRC, file),
                args,
            }))
        );
        // The hook defines the function; everything with an options object is a caller.
        const callers = calls.filter((c) => c.args.includes("statuses"));
        // Five call sites today (two in the project hook, the create form, the
        // to-do modal, the sprint manager). A drop means the scan stopped seeing them.
        expect(callers.length).toBeGreaterThanOrEqual(5);
        const offenders = callers.filter(
            (c) => /statuses\s*:\s*\[/.test(c.args) || !c.args.includes("MILESTONE_LIST_STATUSES")
        );
        expect(offenders).toEqual([]);
    });
});

describe("SprintMilestonePicker with a Blocked milestone", () => {
    const renderPicker = () => {
        const useSM = {
            projectSprints: {
                1: [
                    {
                        sprintId: 11,
                        projectId: 1,
                        name: "Sprint 4",
                        status: "active",
                        startDate: "2026-01-01",
                        endDate: "2026-01-14",
                        isDeleted: false,
                    },
                    {
                        sprintId: 12,
                        projectId: 1,
                        name: "Sprint 3",
                        status: "completed",
                        startDate: "2025-12-15",
                        endDate: "2025-12-31",
                        isDeleted: false,
                    },
                ],
            },
            projectMilestones: {
                1: [
                    {
                        milestoneId: 21,
                        projectId: 1,
                        sprintId: 11,
                        title: "Beta launch",
                        status: "Blocked",
                        isDeleted: false,
                        assignees: [],
                    },
                    {
                        // Blocked work in a sprint that has ended is still work to do.
                        milestoneId: 22,
                        projectId: 1,
                        sprintId: 12,
                        title: "Carry-over",
                        status: "Blocked",
                        isDeleted: false,
                        assignees: [],
                    },
                ],
            },
        } as unknown as SprintMilestoneManagementState;

        render(
            <CssVarsProvider>
                <SprintMilestonePicker
                    milestoneId={null}
                    projectId={1}
                    sprintId={null}
                    useSM={useSM}
                    onChangeMilestone={vi.fn()}
                    onChangeSprint={vi.fn()}
                />
            </CssVarsProvider>
        );
        // [0] sprint, [1] milestone.
        const milestoneInput = screen.getAllByRole("combobox")[1];
        fireEvent.focus(milestoneInput);
        fireEvent.keyDown(milestoneInput, { key: "ArrowDown" });
    };

    it("lists both Blocked milestones with the table's Blocked label (red icon, the word)", () => {
        renderPicker();
        for (const name of [/Beta launch/, /Carry-over/]) {
            const option = screen.getByRole("option", { name });
            const word = option.querySelector("[data-status-word]");
            expect(word?.textContent, `status in ${String(name)}`).toBe("Blocked");
            // The icon carries the status color; no filled Chip says it.
            const icon = word?.previousElementSibling as HTMLElement;
            expect(icon.style.color).toBe("var(--g-danger-text)");
            expect(
                [...option.querySelectorAll(".MuiChip-root")].filter(
                    (el) => el.textContent === "Blocked"
                )
            ).toHaveLength(0);
        }
    });
});
