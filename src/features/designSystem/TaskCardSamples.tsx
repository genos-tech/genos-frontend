import { ReactNode } from "react";
import { Box } from "@mui/joy";

import { AvatarContextProvider } from "../../components/ui/avatars/AvatarContext";
import { g } from "../../theme/tokens";
import type { UserProps } from "../../types/admin";
import type { TaskTableProps } from "../../types/tasks";
import {
    TaskCard,
    TaskCardFrame,
    TaskListItem,
    TaskListPanel,
    type TaskCardTask,
} from "../tasks/components/card";
import { MilestoneNodeView } from "../tasks/diagram/components/MilestoneNodeCard";
import { TaskNodeView } from "../tasks/diagram/components/TaskNodeCard";
import type { TaskNodeData } from "../tasks/diagram/types";

/**
 * The task component family (MIP-1124) as the app uses it: the board, mobile and
 * dashboard cards are `TaskCard`, the dashboard lists are `TaskListItem`. These
 * are the real components with sample data, not drawings of them.
 */

const PROFILES = {
    "ds-1": { userId: "ds-1", userName: "Aiko Tanaka" },
    "ds-2": { userId: "ds-2", userName: "Ben Ito" },
} as unknown as Record<string, UserProps>;

const NOOP = () => {};

// UserAvatar and the live-name lookup read the avatar context; this page has no
// team, so it supplies a two-person roster.
const SampleRoster = ({ children }: { children: ReactNode }) => (
    <AvatarContextProvider
        value={{
            myself: PROFILES["ds-1"],
            setMyself: NOOP,
            teamMemberProfiles: PROFILES,
            setTeamMemberProfiles: NOOP,
            socket: null,
            useCM: {} as never,
            useUISM: {} as never,
        }}
    >
        {children}
    </AvatarContextProvider>
);

// A local calendar date: `toISOString()` is UTC, which is a day off for the
// first hours of the day east of Greenwich.
const day = (offset: number) => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const TAGS = [
    { tagName: "frontend", tagColor: "#3b82f6", tagTextColor: "#fff" },
    { tagName: "UI&UX", tagColor: "#8b5cf6", tagTextColor: "#fff" },
];

const SAMPLES: TaskCardTask[] = [
    {
        id: 41,
        displayId: "GEN-41",
        title: "Move every task surface onto one card",
        status: "WIP",
        priority: "High",
        assigneeId: "ds-1",
        assigneeName: "Aiko Tanaka",
        dueDate: day(2),
        tags: TAGS,
    },
    {
        id: 42,
        displayId: "GEN-42",
        title: "Blocked on the token review",
        status: "Blocked",
        priority: "Critical",
        assigneeId: "ds-2",
        assigneeName: "Ben Ito",
        dueDate: day(-3),
        tags: [],
    },
    {
        id: 43,
        displayId: "GEN-43",
        title: "Unassigned backlog item with a long title that wraps onto a second line and stops there",
        status: "Open",
        priority: null,
        assigneeId: null,
        dueDate: null,
        tags: TAGS,
    },
    {
        id: 44,
        displayId: "GEN-44",
        title: "Launch week",
        status: "Pending",
        priority: "Normal",
        isMilestone: true,
        assigneeId: "ds-1",
        assigneeName: "Aiko Tanaka",
        dueDate: day(20),
        tags: [],
    },
    {
        id: 45,
        displayId: "GEN-45",
        title: "Shipped last week",
        status: "Closed",
        priority: "Low",
        assigneeId: "ds-2",
        assigneeName: "Ben Ito",
        dueDate: null,
        tags: [],
    },
];

// A graph node as the canvas builds it, from sample data. The views render
// without React Flow (no handles), so the page shows the real card.
const nodeData = (
    over: Omit<Partial<TaskNodeData>, "task"> & { task: Partial<TaskTableProps> }
): TaskNodeData => {
    const { task, ...rest } = over;
    return {
        task: {
            id: 1,
            displayId: "GEN-1",
            title: "A task in the graph",
            status: "Open",
            priority: "Normal",
            assigneeId: "ds-1",
            assigneeName: "Aiko Tanaka",
            startDate: day(-2),
            dueDate: day(9),
            isMilestone: false,
            ...task,
        } as unknown as TaskTableProps,
        isRoot: false,
        isCurrentPreview: false,
        isMilestone: false,
        isExternal: false,
        closedDescendantCount: 0,
        totalDescendantCount: 0,
        openBlockerCount: 0,
        projectName: "genos-web",
        onChange: NOOP,
        onAddSubtask: NOOP,
        onDelete: NOOP,
        onOpenPreview: NOOP,
        ...rest,
    };
};

const NODE_STATES: Array<{ label: string; data: TaskNodeData }> = [
    { label: "Plain", data: nodeData({ task: {} }) },
    {
        label: "Root of the graph",
        data: nodeData({ isRoot: true, task: { title: "The task the graph opened from" } }),
    },
    {
        label: "Current preview",
        data: nodeData({ isCurrentPreview: true, task: { status: "WIP", title: "You are here" } }),
    },
    {
        label: "Just created",
        data: nodeData({
            isNewlyCreated: true,
            task: { title: "Added from the graph", startDate: null, dueDate: null },
        }),
    },
    {
        label: "Assigned to the viewer",
        data: nodeData({ isAssignedToViewer: true, task: { title: "One of your tasks" } }),
    },
    {
        label: "Dimmed (another member's)",
        data: nodeData({
            isDimmed: true,
            task: { assigneeId: "ds-2", assigneeName: "Ben Ito", title: "Someone else's task" },
        }),
    },
    {
        label: "Ghost (outside the tree)",
        data: nodeData({
            isExternal: true,
            task: { status: "Closed", title: "A blocker in another project", assigneeId: null },
        }),
    },
    {
        label: "Overdue (red edge)",
        data: nodeData({
            openBlockerCount: 2,
            task: {
                status: "Blocked",
                priority: "Critical",
                title: "Waiting on two blockers",
                startDate: day(-12),
                dueDate: day(-3),
            },
        }),
    },
    {
        label: "Due soon (amber edge)",
        data: nodeData({
            task: { status: "WIP", priority: "High", title: "Due in two days", dueDate: day(2) },
        }),
    },
    {
        label: "Closed",
        data: nodeData({
            task: { status: "Closed", title: "Shipped", priority: "Low", dueDate: day(-1) },
        }),
    },
];

const NODE_STATUSES = ["Open", "WIP", "Blocked", "Pending", "Closed", "Deleted"].map((status) => ({
    label: status,
    data: nodeData({
        task: { status, title: `A ${status} task`, startDate: null, dueDate: null },
    }),
}));

const MILESTONE_NODES: Array<{ label: string; data: TaskNodeData }> = [
    {
        label: "Milestone, behind",
        data: nodeData({
            isMilestone: true,
            closedDescendantCount: 3,
            totalDescendantCount: 15,
            sprint: {
                name: "Sprint 8",
                startDate: day(-12),
                endDate: day(2),
            } as TaskNodeData["sprint"],
            task: {
                isMilestone: true,
                status: "WIP",
                title: "Design system rollout",
                startDate: day(-12),
                dueDate: day(2),
                assigneeId: null,
            },
        }),
    },
    {
        label: "Milestone, on track, current preview",
        data: nodeData({
            isMilestone: true,
            isCurrentPreview: true,
            closedDescendantCount: 9,
            totalDescendantCount: 12,
            sprint: {
                name: "Sprint 8",
                startDate: day(-12),
                endDate: day(2),
            } as TaskNodeData["sprint"],
            task: {
                isMilestone: true,
                status: "Open",
                title: "Mobile polish",
                startDate: day(-12),
                dueDate: day(2),
                assigneeId: null,
            },
        }),
    },
    {
        label: "Milestone, no dates, no tasks",
        data: nodeData({
            isMilestone: true,
            task: {
                isMilestone: true,
                status: "Pending",
                title: "Someday",
                startDate: null,
                dueDate: null,
                assigneeId: null,
            },
        }),
    },
];

const Caption = ({ children }: { children: ReactNode }) => (
    <Box component="span" sx={{ color: g.text.tertiary, fontSize: "var(--g-type-caption-size)" }}>
        {children}
    </Box>
);

const NodeGrid = ({
    items,
    milestone = false,
}: {
    items: Array<{ label: string; data: TaskNodeData }>;
    milestone?: boolean;
}) => (
    <Box
        sx={{
            display: "grid",
            gap: 2,
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 260px))",
        }}
    >
        {items.map((item) => (
            <Box key={item.label} sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
                <Caption>{item.label}</Caption>
                {milestone ? (
                    <MilestoneNodeView data={item.data} />
                ) : (
                    <TaskNodeView data={item.data} />
                )}
            </Box>
        ))}
    </Box>
);

export const TaskCardSamples = () => (
    <SampleRoster>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <Box
                sx={{
                    display: "grid",
                    gap: 1.5,
                    gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
                }}
            >
                <TaskCard task={SAMPLES[0]} showStatus onOpen={NOOP} />
                <TaskCard task={SAMPLES[1]} showStatus onOpen={NOOP} />
                <TaskCard task={SAMPLES[2]} showStatus onOpen={NOOP} />
                <TaskCard task={SAMPLES[3]} showStatus onOpen={NOOP} />
                <TaskCard task={SAMPLES[0]} selected showStatus onOpen={NOOP} />
                <TaskCard task={SAMPLES[1]} dragging showStatus onOpen={NOOP} />
                <TaskCardFrame>
                    <Caption>
                        TaskCardFrame: the surface alone, for card bodies that are not tasks
                    </Caption>
                </TaskCardFrame>
            </Box>
            <Caption>
                Card: the board, the mobile list and the dashboard grid. Top row of each card is
                the id, status and priority; below it the title, tags, assignee and due date.
                Second row: selected and being dragged.
            </Caption>

            <TaskListPanel>
                {SAMPLES.map((s) => (
                    <TaskListItem key={s.id} sprintName="Sprint 8" task={s} onOpen={NOOP} />
                ))}
            </TaskListPanel>
            <Caption>
                Row: Up Next and Top by Weight on the dashboard. The height is the user's density
                setting.
            </Caption>

            <TaskListPanel>
                {SAMPLES.slice(0, 3).map((s) => (
                    <TaskListItem key={s.id} task={s} variant="compact" onOpen={NOOP} />
                ))}
            </TaskListPanel>
            <Caption>Compact: short lists inside a card (Overdue, Due this week).</Caption>

            <NodeGrid items={NODE_STATES} />
            <Caption>
                Task graph node: the same card surface with the graph's highlights as typed states
                (the card the preview came from, a card just added, a card assigned to the viewer),
                a dashed dimmed ghost, and a red or amber edge for urgency. A highlight is a border
                and a halo in a role color, never a tint per status.
            </Caption>
            <NodeGrid items={NODE_STATUSES} />
            <Caption>
                Graph node, one per status: the icon and the word the table uses. No border tint,
                no glow.
            </Caption>
            <NodeGrid items={MILESTONE_NODES} milestone />
            <Caption>
                Graph milestone node: the flag, a stronger border, the pace verdict beside the
                status, a progress bar with the expected-by-now marker.
            </Caption>
        </Box>
    </SampleRoster>
);
