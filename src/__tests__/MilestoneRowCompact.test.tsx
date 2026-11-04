// MIP-1012: milestone rows in a narrow task sidebar. Row 2 (sprint, status,
// avatars) never wraps, so a row is two lines at any width; narrower rows
// compact through CSS container queries (no width state, no ResizeObserver).
// jsdom can't evaluate container queries, so these tests pin the parts it
// can see: the no-wrap row, the containers, the emitted @container rules and
// the indent variables they switch.

import { CssVarsProvider } from "@mui/joy/styles";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MilestonesListItem } from "../features/tasks/components/sidebar/projects_subs/MilestonesListItem";
import type { Milestone, MilestoneFolder, Sprint } from "../features/tasks/sprint-milestone/types";

const P = 1;
const people = ["u1", "u2", "u3", "u4"];
const ms = (
    milestoneId: number,
    title: string,
    over: Partial<Milestone> & { nAssignees?: number } = {}
): Milestone => {
    const { nAssignees = 0, ...rest } = over;
    return {
        milestoneId,
        projectId: P,
        title,
        status: "Open",
        sprintId: null,
        folderId: null,
        isDeleted: false,
        dueDate: "2026-11-20",
        assignees: people
            .slice(0, nAssignees)
            .map((id) => ({ userId: id, username: id, profileImageUrl: null })),
        tasksClosed: 1,
        tasksTotal: 3,
        ...rest,
    } as unknown as Milestone;
};

const SPRINTS = [
    {
        sprintId: 1,
        name: "Old sprint",
        status: "archived",
        isDeleted: false,
        endDate: "2026-10-14",
    },
    { sprintId: 2, name: "A long active sprint name", status: "active", isDeleted: false },
] as unknown as Sprint[];
const FOLDERS: MilestoneFolder[] = [
    { folderId: 1, projectId: P, name: "Q4", sortOrder: 1, tsCreatedAt: "", tsUpdatedAt: "" },
];
const MILESTONES = [
    ms(1, "Four people", { sprintId: 2, nAssignees: 4 }),
    ms(2, "One person", { nAssignees: 1 }),
    ms(3, "In a folder", { folderId: 1, nAssignees: 2 }),
    ms(4, "Archived", { status: "Closed", sprintId: 1, nAssignees: 3 }),
];

const renderSidebar = () =>
    render(
        <CssVarsProvider>
            <MilestonesListItem
                currentProjectId={P}
                myself={{ userId: "me" } as never}
                usePM={{ currentProject: { projectId: P }, teamProjects: [] } as never}
                useTEM={{ teamMemberProfiles: {} } as never}
                useTM={{} as never}
                useSM={
                    {
                        projectSprints: { [P]: SPRINTS },
                        projectMilestones: { [P]: MILESTONES },
                        projectFolders: { [P]: FOLDERS },
                        tsLastMilestonesLoaded: 1,
                        loadFoldersForProject: vi.fn().mockResolvedValue(FOLDERS),
                    } as never
                }
            />
        </CssVarsProvider>
    );

// The milestone row (ListItem) whose title is `title`.
const rowOf = (title: string) => screen.getByText(title).closest("li") as HTMLElement;
const row2Of = (title: string) =>
    rowOf(title).querySelectorAll(".MuiListItemContent-root > .MuiStack-root")[1] as HTMLElement;

// Every CSS rule emotion inserted, as text (whitespace collapsed, and none
// around ">", which serializers differ on).
const allRules = () =>
    [...document.querySelectorAll("style")].flatMap((s) =>
        [...(s.sheet?.cssRules ?? [])].map((r) =>
            r.cssText.replace(/\s+/g, " ").replace(/ ?> ?/g, ">")
        )
    );
const containerRule = (prelude: string) =>
    allRules().find((r) => r.startsWith(`@container ${prelude}`)) ?? "";

describe("MilestonesListItem: narrow-sidebar rows (MIP-1012)", () => {
    it("keeps row 2 on one line: no wrap, clipped, sprint chip shrinks, the rest keep size", () => {
        renderSidebar();
        const row2 = row2Of("Four people");
        expect(row2).toHaveStyle({ flexWrap: "nowrap", minWidth: "0", overflow: "hidden" });

        const sprint = row2.querySelector(".MsRowSprint") as HTMLElement;
        expect(sprint).toHaveTextContent("A long active sprint name");
        expect(sprint).toHaveStyle({ minWidth: "0", flexShrink: "1" });
        expect(within(row2).getByText("Open").closest(".MuiChip-root")).toHaveStyle({
            flexShrink: "0",
        });
        expect(row2.querySelector(".MsRowAvatars")).toHaveStyle({ flexShrink: "0" });
        expect(within(rowOf("Four people")).getByText("1/3").closest(".MuiChip-root")).toHaveStyle(
            { flexShrink: "0" }
        );
    });

    it("renders a hidden '+N' surplus from the FULL assignee list, only for 2+ assignees", () => {
        renderSidebar();
        const surplus = rowOf("Four people").querySelector(".MsRowAvatarSurplus");
        expect(surplus).toHaveTextContent("+3");
        expect(surplus).toHaveStyle({ display: "none" });
        expect(rowOf("In a folder").querySelector(".MsRowAvatarSurplus")).toHaveTextContent("+1");
        expect(rowOf("One person").querySelector(".MsRowAvatarSurplus")).toBeNull();
    });

    it("makes the list and each row's content named size containers", () => {
        const { container } = renderSidebar();
        const list = container.querySelector("ul") as HTMLElement;
        expect(list).toHaveStyle({ containerType: "inline-size", containerName: "ms-list" });
        const content = rowOf("Four people").querySelector(".MuiListItemContent-root");
        expect(content).toHaveStyle({ containerType: "inline-size", containerName: "ms-row" });
    });

    it("emits the @container rules that compact a row", () => {
        renderSidebar();
        const oneAvatar = containerRule("ms-row (max-width: 179px)");
        expect(oneAvatar).toContain(
            ".MsRowAvatars>:nth-child(n+2):not(.MsRowAvatarSurplus) { display: none; }"
        );
        expect(oneAvatar).toContain(".MsRowAvatarSurplus { display: flex; }");
        expect(containerRule("ms-row (max-width: 159px)")).toContain(
            ".MsRowSprint { display: none; }"
        );
        expect(containerRule("ms-row (max-width: 99px)")).toContain(
            ".MsRowAvatars { display: none; }"
        );
        const list = containerRule("ms-list (max-width: 299px)");
        expect(list).toMatch(/>\* \{ --ms-indent-base: 24px; --ms-indent-step: 8px; /);
    });

    it("indents every level of the tree through the shared indent variables", () => {
        const { container } = renderSidebar();
        expect(container.querySelector("ul")).toHaveStyle({
            "--ms-indent-base": "40px",
            "--ms-indent-step": "16px",
        });
        fireEvent.click(screen.getByText("Past milestones"));
        fireEvent.click(screen.getByText("2026"));
        fireEvent.click(screen.getByText("Old sprint"));

        // The row button carrying `text` as its label (a sprint name is also
        // a chip label on the rows under it, so skip chips).
        const indentOf = (text: string) => {
            const label = screen
                .getAllByText(text)
                .find((el) => !el.closest(".MuiChip-root")) as HTMLElement;
            return getComputedStyle(label.closest(".MuiListItemButton-root") as HTMLElement)
                .marginLeft;
        };
        const at = (depth: number) =>
            `calc(var(--ms-indent-base) + ${depth} * var(--ms-indent-step))`;
        expect(indentOf("One person")).toBe(at(0));
        expect(indentOf("Q4")).toBe(at(0));
        expect(indentOf("In a folder")).toBe(at(1));
        expect(indentOf("Past milestones")).toBe(at(0));
        expect(indentOf("2026")).toBe(at(1));
        expect(indentOf("Old sprint")).toBe(at(2));
        expect(indentOf("Archived")).toBe(at(3));
        expect(indentOf("Add milestone")).toBe(at(0));
    });
});
