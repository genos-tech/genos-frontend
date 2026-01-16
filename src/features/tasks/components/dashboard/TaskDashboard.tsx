import { ProjectManagementState } from "../../../../hooks/common/useProjectManagement";
import { TaskManagementState } from "../../../../hooks/tasks/useTaskManagement";
import { TaskHomeContent } from "./TaskHomeContent";

type TaskDashboardProps = {
    useTM: TaskManagementState;
    usePM: ProjectManagementState;
};

export const TaskDashboard = ({ useTM, usePM }: TaskDashboardProps) => {
    return <TaskHomeContent useTM={useTM} usePM={usePM} />;
};
