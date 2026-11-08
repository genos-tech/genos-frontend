/**
 * MIP-1191 (the rest of MIP-1157 "be consistent everywhere"): a status, a sprint
 * state and the graph header's schedule verdicts are drawn with the table's
 * pieces (`StatusLabel`, the quiet `ToneLabel`), never a filled Joy Chip or a
 * per-status color map. Each surface here is rendered for every value and must
 * show the icon (or dot) and the word; a source scan pins the files so the old
 * chips cannot come back.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { useEffect } from "react";
import { CssVarsProvider } from "@mui/joy/styles";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AvatarContextProvider } from "../components/ui/avatars/AvatarContext";
import { AssignedMilestoneCard } from "../features/tasks/components/dashboard/AssignedMilestoneCard";
import { SprintStatusLabel, ToneLabel } from "../features/tasks/components/meta/ToneLabel";
import { ModalTaskDiagram } from "../features/tasks/diagram/components/ModalTaskDiagram";
import type { ScheduleOverview } from "../features/tasks/diagram/types";
import { STATUS_NAMES } from "../features/tasks/meta/taskTone";
import { SprintMilestonePicker } from "../features/tasks/sprint-milestone/components/SprintMilestonePicker";
import type { Milestone, Sprint } from "../features/tasks/sprint-milestone/types";
import type { UserProps } from "../types/admin";

const srcDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = (path: string) => readFileSync(resolve(srcDir, path), "utf8");
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const WORDS: Record<string, string> = {
    Open: "Open",
    WIP: "WIP",
    Blocked: "Blocked",
    Pending: "Pending",
    Closed: "Closed",
    Deleted: "Deleted",
};

const wrap = (ui: React.ReactElement) => render(<CssVarsProvider>{ui}</CssVarsProvider>);

// What the old chips were: a filled Joy Chip whose text is the status word.
const chipWithText = (root: ParentNode, word: string) =>
    Array.from(root.querySelectorAll(".MuiChip-root")).filter(
        (c) => (c.textContent ?? "").trim() === word
    );

describe("ToneLabel and SprintStatusLabel", () => {
    it("draws a tone as a quiet label: color in the glyph, no fill, no Chip", () => {
        const { container } = wrap(
            <ToneLabel icon={<svg data-testid="glyph" />} tone="danger">
                3 overdue
            </ToneLabel>
        );
        const el = container.querySelector("[data-tone]") as HTMLElement;
        expect(el.getAttribute("data-tone")).toBe("danger");
        expect(el.style.color).toBe("var(--g-danger-text)");
        expect(el.style.background).toBe("");
        expect(screen.getByTestId("glyph")).toBeTruthy();
        expect(container.querySelector(".MuiChip-root")).toBeNull();
    });

    it.each([
        ["upcoming", "Upcoming", "neutral"],
        ["active", "Active", "info"],
        ["completed", "Completed", "success"],
        ["archived", "Archived", "muted"],
    ])("sprint %s: a dot and the word, in the %s tone", (status, word, tone) => {
        const { container } = wrap(<SprintStatusLabel status={status} />);
        expect(screen.getByText(word)).toBeTruthy();
        expect(container.querySelector("[data-tone-dot]")).toBeTruthy();
        expect(container.querySelector("[data-tone]")?.getAttribute("data-tone")).toBe(tone);
        expect(container.querySelector(".MuiChip-root")).toBeNull();
    });

    it("an unknown sprint status is its own name in a neutral tone, nothing is invented", () => {
        const { container } = wrap(<SprintStatusLabel status="constructor" />);
        expect(container.textContent).toBe("constructor");
        expect(container.querySelector("[data-tone]")?.getAttribute("data-tone")).toBe("neutral");
    });
});

const milestone = (milestoneId: number, status: string, sprintId: number | null = null) =>
    ({
        milestoneId,
        taskId: 1000 + milestoneId,
        displayId: `MIP-${milestoneId}`,
        projectId: 1,
        teamId: 1,
        title: `Milestone ${status}`,
        status,
        sprintId,
        isDeleted: false,
        assignees: [],
        tags: [],
        dueDate: null,
        tasksTotal: 2,
        tasksClosed: 1,
    }) as unknown as Milestone;

const sprint = (sprintId: number, status: Sprint["status"]): Sprint =>
    ({
        sprintId,
        projectId: 1,
        name: `Sprint ${status}`,
        sequenceNumber: sprintId,
        startDate: "2026-11-01",
        endDate: "2026-11-14",
        status,
        isDeleted: false,
    }) as unknown as Sprint;

const useSMWith = (sprints: Sprint[], milestones: Milestone[]) =>
    ({
        projectSprints: { 1: sprints },
        projectMilestones: { 1: milestones },
    }) as never;

describe("the sprint / milestone picker", () => {
    // "Deleted" milestones are never offered, so the picker has no option for them.
    it.each(STATUS_NAMES.filter((n) => n !== "Deleted"))(
        "milestone option, status %s: StatusLabel (icon + word), no Chip",
        (s) => {
            wrap(
                <SprintMilestonePicker
                    milestoneId={null}
                    projectId={1}
                    showSprint={false}
                    sprintId={null}
                    useSM={useSMWith([], [milestone(1, s)])}
                    onChangeMilestone={() => undefined}
                    onChangeSprint={() => undefined}
                />
            );
            fireEvent.mouseDown(screen.getByRole("combobox"));
            const option = screen
                .getAllByRole("option")
                .find((o) => (o.textContent ?? "").includes(`Milestone ${s}`))!;
            const word = option.querySelector("[data-status-word]");
            expect(word?.textContent).toBe(WORDS[s]);
            expect(
                option.querySelector("[data-status-word]")?.parentElement?.querySelector("svg")
            ).toBeTruthy();
            expect(chipWithText(option, WORDS[s])).toHaveLength(0);
        }
    );

    it.each([
        ["upcoming", "Upcoming"],
        ["active", "Active"],
        ["completed", "Completed"],
        ["archived", "Archived"],
    ] as const)("sprint option, status %s: dot and word, no Chip", (status, word) => {
        // The chosen sprint is always offered, so a finished one is reachable too.
        wrap(
            <SprintMilestonePicker
                milestoneId={null}
                projectId={1}
                showMilestone={false}
                sprintId={7}
                useSM={useSMWith([sprint(7, status)], [])}
                onChangeMilestone={() => undefined}
                onChangeSprint={() => undefined}
            />
        );
        fireEvent.mouseDown(screen.getByRole("combobox"));
        const option = screen
            .getAllByRole("option")
            .find((o) => (o.textContent ?? "").includes(`Sprint ${status}`))!;
        expect(option.querySelector("[data-tone-dot]")).toBeTruthy();
        expect(option.textContent).toContain(word);
        expect(chipWithText(option, word)).toHaveLength(0);
    });
});

describe("the dashboard's Assigned Milestones card", () => {
    it.each(STATUS_NAMES)("status %s is a StatusLabel", (s) => {
        wrap(
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
                <AssignedMilestoneCard
                    milestone={milestone(7, s)}
                    sprintName={null}
                    onOpen={vi.fn()}
                />
            </AvatarContextProvider>
        );
        expect(document.querySelector("[data-status-word]")?.textContent).toBe(WORDS[s]);
        expect(chipWithText(document.body, WORDS[s])).toHaveLength(0);
    });
});

// The graph modal: the canvas is mocked to publish a schedule overview.
const OVERVIEW = {
    spanStart: "2026-11-01",
    spanEnd: "2026-11-30",
    spanDays: 30,
    total: 10,
    closed: 2,
    sprint: null,
    overdueCount: 3,
    dueSoonCount: 2,
    blockedCount: 1,
    burndown: null,
    health: { tone: "behind", label: "Behind", expectedPct: 60, actualPct: 20 },
} as unknown as ScheduleOverview;

let overviewToPublish: ScheduleOverview = OVERVIEW;
vi.mock("../features/tasks/diagram/components/TaskFlowCanvas", () => ({
    TaskFlowCanvas: ({
        onOverviewChange,
    }: {
        onOverviewChange: (o: ScheduleOverview) => void;
    }) => {
        useEffect(() => onOverviewChange(overviewToPublish), [onOverviewChange]);
        return <div data-testid="canvas" />;
    },
}));

const renderGraph = (overview: ScheduleOverview) => {
    overviewToPublish = overview;
    return wrap(
        <ModalTaskDiagram
            myself={{ userId: "u1", teamId: "t1" } as never}
            projectId={1}
            rootLabel="KDS-5 · Five"
            rootTaskId={5}
            usePM={{} as never}
            useTM={{} as never}
            open
            onClose={vi.fn()}
        />
    );
};

describe("the graph modal header", () => {
    it.each([
        ["behind", "Behind", "danger"],
        ["at-risk", "At risk", "warning"],
        ["on-track", "On track", "success"],
    ])("health %s is a quiet %s label, not a filled Chip", (tone, word, expected) => {
        renderGraph({ ...OVERVIEW, health: { ...OVERVIEW.health!, tone } as never });
        const labels = Array.from(document.querySelectorAll("[data-tone]"));
        const health = labels.find((l) => (l.textContent ?? "").trim() === word)!;
        expect(health.getAttribute("data-tone")).toBe(expected);
        expect(health.querySelector("[data-tone-dot]")).toBeTruthy();
        expect(chipWithText(document.body, word)).toHaveLength(0);
    });

    it("overdue, due soon and blocked are tone labels with their glyph, not Chips", () => {
        renderGraph(OVERVIEW);
        const byTone = (tone: string) =>
            Array.from(document.querySelectorAll(`[data-tone="${tone}"]`)).map(
                (e) => e.textContent ?? ""
            );
        expect(byTone("danger").join("|")).toMatch(/3.*\|.*1/);
        expect(byTone("warning").join("|")).toMatch(/2/);
        for (const el of document.querySelectorAll("[data-tone]")) {
            if (el.textContent !== "Behind") expect(el.querySelector("svg")).toBeTruthy();
        }
        // The only Joy Chip left in the header is the plain "30d" duration.
        const chips = Array.from(document.querySelectorAll(".MuiChip-root")).map((c) =>
            (c.textContent ?? "").trim()
        );
        expect(chips.filter((c) => /overdue|due soon|blocked|behind/i.test(c))).toEqual([]);
    });
});

describe("the files stay on the shared pieces", () => {
    const BANNED =
        /TaskStatusChip|STATUS_COLORS|STATUS_FILL|HEALTH_TONE_COLOR|HEALTH_JOY_COLOR|toneJoyColor|MILESTONE_STATUS_COLOR|SPRINT_STATUS_COLOR/;

    it.each([
        "features/tasks/diagram/components/ModalTaskDiagram.tsx",
        "features/tasks/diagram/components/BurndownSparkline.tsx",
        "features/tasks/components/contents/base/TaskMainBlock.tsx",
        "features/tasks/components/modals/ModalManageDependencies.tsx",
        "features/tasks/sprint-milestone/components/SprintManagerDialog.tsx",
        "features/tasks/sprint-milestone/components/SprintMilestonePicker.tsx",
        "features/tasks/components/dashboard/TaskHomeContent.tsx",
        "features/tasks/components/dashboard/AssignedMilestoneCard.tsx",
        "features/spotlight/SpotlightResultItem.tsx",
        "features/agentQA/mentions/MentionSuggestionDropdown.tsx",
        "components/editors/HashMention.tsx",
        "features/tasks/components/sidebar/RecentProjectGroup.tsx",
    ])("%s has no status color map and no TaskStatusChip", (file) => {
        expect(strip(source(file))).not.toMatch(BANNED);
    });

    it("TaskStatusChip is gone", () => {
        expect(() => source("features/tasks/components/TaskStatusChip.tsx")).toThrow();
    });

    it.each([
        ["Spotlight result", "features/spotlight/SpotlightResultItem.tsx", "<StatusLabel"],
        [
            "mention dropdown",
            "features/agentQA/mentions/MentionSuggestionDropdown.tsx",
            "<StatusLabel",
        ],
        ["# mention menu", "components/editors/HashMention.tsx", "<StatusLabel"],
        [
            "sprint manager milestones",
            "features/tasks/sprint-milestone/components/SprintManagerDialog.tsx",
            "<StatusLabel",
        ],
        [
            "Blocked badge",
            "features/tasks/components/contents/base/TaskMainBlock.tsx",
            '<StatusLabel status="Blocked"',
        ],
        [
            "dashboard stat cards",
            "features/tasks/components/dashboard/TaskHomeContent.tsx",
            "<StatusLabel",
        ],
        [
            "dependency id",
            "features/tasks/components/modals/ModalManageDependencies.tsx",
            "<TaskIdText",
        ],
        ["Recents id", "features/tasks/components/sidebar/RecentProjectGroup.tsx", "<TaskIdText"],
    ])("%s uses the shared piece", (_name, file, marker) => {
        expect(source(file)).toContain(marker);
    });

    it("the graph header and sprint picker draw their verdicts with ToneLabel", () => {
        expect(source("features/tasks/diagram/components/ModalTaskDiagram.tsx")).toContain(
            "<ToneLabel"
        );
        expect(
            source("features/tasks/sprint-milestone/components/SprintMilestonePicker.tsx")
        ).toContain("<SprintStatusLabel");
    });

    it("the dashboard status bars read the tone source, with no literal color", () => {
        const text = strip(
            source("features/tasks/components/dashboard/TaskHomeContent.tsx")
        ).replace(/\s+/g, "");
        expect(text).toContain("toneSolid(STATUS_TONE[status])");
        expect(text).toContain("toneCss(STATUS_TONE[cell.key])");
        // The per-status count cell and the status card are not Chips or washes.
        expect(text).not.toMatch(/sc\.(bg|text)/);
    });
});
