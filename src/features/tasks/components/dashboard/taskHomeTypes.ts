import { Socket } from "socket.io-client";

import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { ProjectManagementState } from "../../../../hooks/common/useProjectManagement";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { SprintMilestoneManagementState } from "../../../../hooks/tasks/useSprintMilestoneManagement";
import { TaskManagementState } from "../../../../hooks/tasks/useTaskManagement";
import { UserProps } from "../../../../types/admin";
import { DueBucket } from "../../utils/taskWeight";

/** The dashboard's tabs. `agent` is the Agent Activity tab (MIP-1613). */
export type TaskDashboardTab =
    | "today"
    | "overall"
    | "sprint"
    | "milestones"
    | "mytasks"
    | "members"
    | "agent";

export type TaskHomeContentProps = {
    useTM: TaskManagementState;
    usePM: ProjectManagementState;
    useTEM: TeamManagementState;
    useSM: SprintMilestoneManagementState;
    myself: UserProps;
    setMyself: (me: UserProps) => void;
    useCM: ChatManagementState;
    useUISM: UIStateManagementState;
    socket: Socket | null;
    onCloseTaskHome: () => void;
};

// Midnight-of-today in ms — the "overdue" cutoff for the urgency sorts.

// Per-assignee effort load, bucketed by due-window. Shared by the
// current-project pass (which fixes the ROSTER) and the team-wide pass
// (which supplies each member's cross-project numbers) so the two can't
// diverge in how they count effort. Milestone-backing rows are excluded —
// their child tasks already carry the effort — and Closed (rolled-up)
// tasks don't count toward load.
export type CapacityEntry = {
    id: string;
    name: string;
    imgPath: string | null;
    buckets: Record<DueBucket, number>;
    total: number;
    nearTerm: number;
    count: number;
};
