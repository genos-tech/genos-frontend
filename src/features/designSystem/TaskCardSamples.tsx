import { ReactNode } from "react";
import { Box } from "@mui/joy";

import { AvatarContextProvider } from "../../components/ui/avatars/AvatarContext";
import { g } from "../../theme/tokens";
import type { UserProps } from "../../types/admin";
import {
    TaskCard,
    TaskCardFrame,
    TaskListItem,
    TaskListPanel,
    type TaskCardTask,
} from "../tasks/components/card";

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

const day = (offset: number) => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return d.toISOString().slice(0, 10);
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

const Caption = ({ children }: { children: ReactNode }) => (
    <Box component="span" sx={{ color: g.text.tertiary, fontSize: "var(--g-type-caption-size)" }}>
        {children}
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
        </Box>
    </SampleRoster>
);
