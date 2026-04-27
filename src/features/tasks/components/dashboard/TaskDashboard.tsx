import { ProjectManagementState } from "../../../../hooks/common/useProjectManagement";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { TaskManagementState } from "../../../../hooks/tasks/useTaskManagement";
import { TaskHomeContent } from "./TaskHomeContent";

type TaskDashboardProps = {
    useTM: TaskManagementState;
    usePM: ProjectManagementState;
    useTEM: TeamManagementState;
};

export const TaskDashboard = ({ useTM, usePM, useTEM }: TaskDashboardProps) => {
    return <TaskHomeContent useTM={useTM} usePM={usePM} useTEM={useTEM} />;
};
