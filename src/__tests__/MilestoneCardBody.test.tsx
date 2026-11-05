/**
 * MIP-1048. The sprint board's milestone card and the My Tasks "Assigned
 * Milestones" card now draw one shared body. What the two share (tags under
 * the progress bar, the assignee's name in the footer) and what differs (the
 * top-right corner: status chip on My Tasks, "Open task graph" on the board)
 * is pinned here, along with the click contract the board card must keep.
 */
import { DragDropContext, Droppable } from "@hello-pangea/dnd";
import { CssVarsProvider } from "@mui/joy/styles";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AvatarContextProvider } from "../components/ui/avatars/AvatarContext";
import { SprintBoardCard } from "../features/tasks/components/board/SprintBoardCard";
import { AssignedMilestoneCard } from "../features/tasks/components/dashboard/AssignedMilestoneCard";
import { Milestone } from "../features/tasks/sprint-milestone/types";
import { TASK_TEMPLATES } from "../features/tasks/utils/taskTemplates";
import { UserProps } from "../types/admin";
import { TaskTableProps } from "../types/tasks";

const assignee = (userId: string, firstName: string, lastName: string) => ({
    userId,
    username: firstName.toLowerCase(),
    firstName,
    lastName,
    email: null,
    profileImageUrl: null,
});

const makeMilestone = (over: Partial<Milestone> = {}): Milestone =>
    ({
        milestoneId: 7,
        taskId: 70,
        displayId: "MIP-70",
        projectId: 1,
        teamId: 1,
        sprintId: null,
        reporterId: null,
        title: "Launch week",
        description: [],
        status: "WIP",
        statusCode: 1,
        priority: "Normal",
        priorityCode: null,
        startDate: null,
        dueDate: null,
        tags: [{ tagName: "release", tagColor: "#3366ff" }],
        assignees: [assignee("u-1", "Aiko", "Tanaka")],
        tasksTotal: 4,
        tasksClosed: 1,
        ...over,
    }) as unknown as Milestone;

const milestoneRow = (over: Partial<TaskTableProps> = {}): TaskTableProps =>
    ({
        id: "70",
        displayId: "MIP-70",
        title: "Launch week",
        status: "WIP",
        priority: "Normal",
        tags: [],
        projectId: 1,
        parentTaskId: null,
        isMilestone: true,
        milestoneId: 7,
        assigneeId: null,
        assigneeName: "",
        dueDate: null,
        ...over,
    }) as unknown as TaskTableProps;

// UserAvatar and the live-name lookup both read the avatar context; `profiles`
// is the team roster (a rename shows up there before the milestone's cached
// assignee name catches up).
const withContext = (node: React.ReactNode, profiles: Record<string, UserProps> = {}) => (
    <AvatarContextProvider
        value={{
            myself: { userId: "me", userName: "Me" } as unknown as UserProps,
            setMyself: () => {},
            teamMemberProfiles: profiles,
            setTeamMemberProfiles: () => {},
            socket: null,
            useCM: {} as never,
            useUISM: {} as never,
        }}
    >
        <CssVarsProvider>{node}</CssVarsProvider>
    </AvatarContextProvider>
);

const renderDashboardCard = (
    milestone: Milestone,
    onOpen = vi.fn(),
    profiles: Record<string, UserProps> = {}
) =>
    render(
        withContext(
            <AssignedMilestoneCard milestone={milestone} sprintName="Sprint 9" onOpen={onOpen} />,
            profiles
        )
    );

type BoardProps = {
    task?: TaskTableProps;
    milestone?: Milestone;
    onTaskClick?: (t: TaskTableProps) => void;
    onOpenDiagram?: (t: TaskTableProps) => void;
};

const renderBoardCard = ({
    task = milestoneRow(),
    milestone,
    onTaskClick = vi.fn(),
    onOpenDiagram = vi.fn(),
}: BoardProps = {}) =>
    render(
        withContext(
            <DragDropContext onDragEnd={() => {}}>
                <Droppable droppableId="col">
                    {(provided) => (
                        <div ref={provided.innerRef} {...provided.droppableProps}>
                            <SprintBoardCard
                                index={0}
                                milestone={milestone}
                                myself={{} as UserProps}
                                sprintName="Sprint 9"
                                task={task}
                                teamMemberProfiles={{}}
                                onOpenDiagram={onOpenDiagram}
                                onTaskClick={onTaskClick}
                            />
                            {provided.placeholder}
                        </div>
                    )}
                </Droppable>
            </DragDropContext>
        )
    );

const cards = [
    {
        name: "My Tasks milestone card",
        renderCard: (m: Milestone) => renderDashboardCard(m),
    },
    {
        name: "sprint board milestone card",
        renderCard: (m: Milestone) => renderBoardCard({ milestone: m }),
    },
];

describe.each(cards)("shared milestone body on the $name", ({ renderCard }) => {
    beforeEach(() => localStorage.clear());

    it("renders the milestone's own title, id, sprint and progress", () => {
        renderCard(makeMilestone());
        expect(screen.getByText("Launch week")).toBeTruthy();
        expect(screen.getByText("MIP-70")).toBeTruthy();
        expect(screen.getByText("Sprint 9")).toBeTruthy();
        expect(screen.getByText("1/4 done")).toBeTruthy();
    });

    it("never flags a milestone for having no body", () => {
        // A missing description is the author's choice, not something to warn about.
        for (const description of [null, [], TASK_TEMPLATES.milestone.blocks]) {
            const { unmount } = renderCard(
                makeMilestone({ description: description as Milestone["description"] })
            );
            expect(screen.getByText("Launch week")).toBeTruthy();
            expect(screen.queryByText("No goal")).toBeNull();
            unmount();
        }
    });

    it("puts the tag chips right under the progress bar", () => {
        renderCard(makeMilestone());
        const bar = screen.getByRole("progressbar");
        const tags = screen.getByTestId("milestone-card-tags");
        expect(tags.textContent).toContain("release");
        // The progress row is the tags row's previous sibling: nothing sits
        // between the bar and the tags.
        const progressRow = tags.previousElementSibling as HTMLElement;
        expect(progressRow.contains(bar)).toBe(true);
    });

    it("keeps the tags out of the footer, next to the avatar", () => {
        renderCard(makeMilestone());
        const tags = screen.getByTestId("milestone-card-tags");
        const footer = screen.getByText("Aiko Tanaka").closest("div[class]")?.parentElement;
        expect(footer).toBeTruthy();
        expect(footer?.contains(tags)).toBe(false);
    });

    it("shows no tag row for a milestone without tags", () => {
        renderCard(makeMilestone({ tags: [] }));
        expect(screen.queryByTestId("milestone-card-tags")).toBeNull();
    });

    it("caps the tags at three and counts the rest", () => {
        const many = ["a", "b", "c", "d", "e"].map((n) => ({
            tagName: `tag-${n}`,
            tagColor: "#999",
        }));
        renderCard(makeMilestone({ tags: many as unknown as Milestone["tags"] }));
        const tags = screen.getByTestId("milestone-card-tags");
        expect(tags.textContent).toContain("tag-c");
        expect(tags.textContent).not.toContain("tag-d");
        expect(tags.textContent).toContain("+2");
    });

    it("names the assignee in the footer", () => {
        renderCard(makeMilestone());
        expect(screen.getByText("Aiko Tanaka")).toBeTruthy();
    });

    it("names the first of several assignees and counts the others", () => {
        renderCard(
            makeMilestone({
                assignees: [
                    assignee("u-1", "Aiko", "Tanaka"),
                    assignee("u-2", "Ben", "Ito"),
                    assignee("u-3", "Chika", "Mori"),
                ],
            })
        );
        expect(screen.getByText("Aiko Tanaka")).toBeTruthy();
        expect(screen.queryByText("Ben Ito")).toBeNull();
        expect(screen.getByText("+2")).toBeTruthy();
    });

    it("says Unassigned when nobody is assigned", () => {
        renderCard(makeMilestone({ assignees: [] }));
        expect(screen.getByText("Unassigned")).toBeTruthy();
    });
});

describe("assignee name", () => {
    beforeEach(() => localStorage.clear());

    it("shows the live profile name over the name cached on the milestone", () => {
        // The card reads the roster, so a rename shows without a reload.
        const m = makeMilestone();
        const profiles = {
            "u-1": { userId: "u-1", userName: "Aiko Renamed" } as unknown as UserProps,
        };
        renderDashboardCard(m, vi.fn(), profiles);
        expect(screen.getByText("Aiko Renamed")).toBeTruthy();
        expect(screen.queryByText("Aiko Tanaka")).toBeNull();
    });
});

describe("top-right corner", () => {
    beforeEach(() => localStorage.clear());

    it("My Tasks card: shows the status chip", () => {
        renderDashboardCard(makeMilestone());
        expect(screen.getByText("WIP")).toBeTruthy();
    });

    it("board card: no status chip (the column is the status), a graph button instead", () => {
        renderBoardCard({ milestone: makeMilestone() });
        expect(screen.queryByText("WIP")).toBeNull();
        expect(screen.getByRole("button", { name: "Open task graph" })).toBeTruthy();
    });
});

describe("board milestone card keeps its click behaviour", () => {
    beforeEach(() => localStorage.clear());

    it("a click on the card opens the milestone preview, not the graph", () => {
        const onTaskClick = vi.fn();
        const onOpenDiagram = vi.fn();
        renderBoardCard({ milestone: makeMilestone(), onTaskClick, onOpenDiagram });
        fireEvent.click(screen.getByText("Launch week"));
        expect(onTaskClick).toHaveBeenCalledTimes(1);
        expect(onTaskClick.mock.calls[0][0].isMilestone).toBe(true);
        expect(onOpenDiagram).not.toHaveBeenCalled();
    });

    it("the graph button opens the graph and does not also open the preview", () => {
        const onTaskClick = vi.fn();
        const onOpenDiagram = vi.fn();
        renderBoardCard({ milestone: makeMilestone(), onTaskClick, onOpenDiagram });
        fireEvent.click(screen.getByRole("button", { name: "Open task graph" }));
        expect(onOpenDiagram).toHaveBeenCalledTimes(1);
        expect(onTaskClick).not.toHaveBeenCalled();
    });
});

describe("board card fallbacks", () => {
    beforeEach(() => localStorage.clear());

    it("a milestone row whose Milestone is not loaded yet keeps the plain task layout", () => {
        renderBoardCard({ milestone: undefined });
        expect(screen.getByText("Launch week")).toBeTruthy();
        expect(screen.queryByRole("progressbar")).toBeNull();
        // The graph button is still there.
        expect(screen.getByRole("button", { name: "Open task graph" })).toBeTruthy();
    });

    it("a task card never takes the milestone layout, even when handed a milestone", () => {
        renderBoardCard({
            task: milestoneRow({ isMilestone: false, milestoneId: null }),
            milestone: makeMilestone(),
        });
        expect(screen.queryByRole("progressbar")).toBeNull();
        expect(screen.queryByText("1/4 done")).toBeNull();
    });
});
