/**
 * MIP-926. The sprint-board card and the dashboard's Assigned Milestones card
 * each kept their own priority-colour map (Critical / High / "Medium" / Low).
 * The product has no "Medium": its priorities are Minimal / Low / Normal / High
 * / Critical, so Normal and Minimal cards got no chip at all. Both cards now
 * read the task table's `priorities` list, so every real priority gets a chip
 * and the colours cannot drift from the table again.
 */
import { DragDropContext, Droppable } from "@hello-pangea/dnd";
import { CssVarsProvider } from "@mui/joy/styles";
import { alpha } from "@mui/system";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { SprintBoardCard } from "../features/tasks/components/board/SprintBoardCard";
import { AssignedMilestoneCard } from "../features/tasks/components/dashboard/AssignedMilestoneCard";
import { Milestone } from "../features/tasks/sprint-milestone/types";
import { priorities } from "../features/tasks/utils/taskMeta";
import { UserProps } from "../types/admin";
import { TaskTableProps } from "../types/tasks";

const REAL_PRIORITIES = ["Minimal", "Low", "Normal", "High", "Critical"];

// jsdom normalises a colour when it is written to a style, so compare through
// the same normalisation instead of a hand-formatted string.
const normalised = (css: string): string => {
    const probe = document.createElement("span");
    probe.style.color = css;
    return probe.style.color;
};

const task = (priority: string | null): TaskTableProps =>
    ({
        id: "1",
        displayId: "MIP-1",
        title: "Card title",
        status: "Open",
        priority,
        tags: [],
        projectId: 1,
        parentTaskId: null,
        isMilestone: false,
        assigneeId: null,
        assigneeName: "",
        dueDate: null,
    }) as unknown as TaskTableProps;

const milestone = (priority: string | null): Milestone =>
    ({
        milestoneId: 1,
        taskId: 10,
        projectId: 1,
        teamId: 1,
        sprintId: null,
        reporterId: null,
        title: "Card title",
        description: [],
        status: "Open",
        statusCode: 0,
        priority,
        priorityCode: null,
        startDate: null,
        dueDate: null,
        tags: [],
        assignees: [],
        tasksTotal: 0,
        tasksClosed: 0,
    }) as unknown as Milestone;

type Mode = "light" | "dark";

const renderBoardCard = (priority: string | null, mode: Mode = "light") =>
    render(
        <CssVarsProvider defaultMode={mode}>
            <DragDropContext onDragEnd={() => {}}>
                <Droppable droppableId="col">
                    {(provided) => (
                        <div ref={provided.innerRef} {...provided.droppableProps}>
                            <SprintBoardCard
                                index={0}
                                myself={{} as UserProps}
                                task={task(priority)}
                                teamMemberProfiles={{}}
                            />
                            {provided.placeholder}
                        </div>
                    )}
                </Droppable>
            </DragDropContext>
        </CssVarsProvider>
    );

const renderMilestoneCard = (priority: string | null, mode: Mode = "light") =>
    render(
        <CssVarsProvider defaultMode={mode}>
            <AssignedMilestoneCard
                milestone={milestone(priority)}
                sprintName={null}
                onOpen={() => {}}
            />
        </CssVarsProvider>
    );

const cards = [
    { name: "sprint board card", renderCard: renderBoardCard },
    { name: "assigned milestone card", renderCard: renderMilestoneCard },
];

describe.each(cards)("priority chip on the $name", ({ renderCard }) => {
    // Joy remembers the colour mode in localStorage; a mode left by the previous
    // test would win over this test's `defaultMode`.
    beforeEach(() => localStorage.clear());

    it.each(REAL_PRIORITIES)("shows a %s chip", (priority) => {
        renderCard(priority);
        // The card itself mounted, so a missing chip below is a real miss.
        expect(screen.getByText("Card title")).toBeTruthy();
        expect(screen.getByText(priority)).toBeTruthy();
    });

    it.each(REAL_PRIORITIES)("paints the %s chip with the task table's colour", (priority) => {
        renderCard(priority);
        const hex = priorities.find((p) => p.priority === priority)?.color as string;
        expect(hex).toBeTruthy();
        const chip = screen.getByText(priority);
        expect(chip.style.backgroundColor).toBe(normalised(alpha(hex, 0.75)));
    });

    it("pins the exact colours so a palette change is a deliberate edit", () => {
        // Hard-coded on purpose: the tests above read the same list the cards
        // do, so on their own they would pass for any colours.
        const expected: Record<string, string> = {
            Minimal: "rgba(156, 163, 175, 0.75)",
            Low: "rgba(52, 211, 153, 0.75)",
            Normal: "rgba(59, 130, 246, 0.75)",
            High: "rgba(245, 158, 11, 0.75)",
            Critical: "rgba(239, 68, 68, 0.75)",
        };
        for (const [priority, rgba] of Object.entries(expected)) {
            const { unmount } = renderCard(priority);
            expect(screen.getByText(priority).style.backgroundColor).toBe(normalised(rgba));
            unmount();
        }
    });

    it("uses the table's white label colour", () => {
        renderCard("Normal");
        expect(screen.getByText("Normal").style.color).toBe(normalised("white"));
    });

    it("uses the table's lighter tint in dark mode", () => {
        renderCard("Normal", "dark");
        const hex = priorities.find((p) => p.priority === "Normal")?.color as string;
        expect(screen.getByText("Normal").style.backgroundColor).toBe(normalised(alpha(hex, 0.5)));
    });

    it("shows no chip when the card has no priority", () => {
        renderCard(null);
        expect(screen.getByText("Card title")).toBeTruthy();
        for (const p of REAL_PRIORITIES) expect(screen.queryByText(p)).toBeNull();
    });

    it("shows no chip, and does not crash, for a value that is not a priority", () => {
        // "Medium" was the old maps' only non-product entry: it is no longer
        // painted. An unrecognised value is left out, as in the task table.
        for (const odd of ["Medium", "Urgent", ""]) {
            const { unmount } = renderCard(odd);
            expect(screen.getByText("Card title")).toBeTruthy();
            if (odd) expect(screen.queryByText(odd)).toBeNull();
            unmount();
        }
    });
});
