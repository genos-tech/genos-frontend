import { useAuth } from "../../../../../context/authState";
import type { TaskManagementState } from "../../../../../hooks/tasks/useTaskManagement";
import type { UserProps } from "../../../../../types/admin";
import { TodayAgentsCard } from "../../../../today/TodayAgentsCard";
import { TodayBriefing } from "../../../../today/TodayBriefing";
import { useAgentsToday } from "../../../../today/useAgentsToday";
import { useQuickActionView, useTodayQuickActions } from "../../../../today/useTodayQuickActions";
import type { TaskHomeData } from "../useTaskHomeData";

type TodayTabProps = Pick<TaskHomeData, "todayView"> & {
    useTM: TaskManagementState;
    myself: UserProps;
};

/** The Today tab: the briefing, with "Mark done" / "Move to tomorrow" on the member's own rows (MIP-1992). */
export const TodayTab = ({ todayView, useTM, myself }: TodayTabProps) => {
    const { accessToken } = useAuth();
    const { view } = useQuickActionView(todayView);
    const onAction = useTodayQuickActions({
        useTM,
        myself,
        localDate: todayView.data?.window.localDate,
        data: todayView.data,
    });
    // "Your agents today" (MIP-2004): one request, and no card at all without agent activity.
    const agents = useAgentsToday(accessToken, myself.teamId);
    return (
        <TodayBriefing extra={<TodayAgentsCard data={agents} />} view={view} onAction={onAction} />
    );
};
