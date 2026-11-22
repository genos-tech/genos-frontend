import type { TaskManagementState } from "../../../../../hooks/tasks/useTaskManagement";
import type { UserProps } from "../../../../../types/admin";
import { TodayBriefing } from "../../../../today/TodayBriefing";
import { useQuickActionView, useTodayQuickActions } from "../../../../today/useTodayQuickActions";
import type { TaskHomeData } from "../useTaskHomeData";

type TodayTabProps = Pick<TaskHomeData, "todayView"> & {
    useTM: TaskManagementState;
    myself: UserProps;
};

/** The Today tab: the briefing, with "Mark done" / "Move to tomorrow" on the member's own rows (MIP-1992). */
export const TodayTab = ({ todayView, useTM, myself }: TodayTabProps) => {
    const { view } = useQuickActionView(todayView);
    const onAction = useTodayQuickActions({
        useTM,
        myself,
        localDate: todayView.data?.window.localDate,
        data: todayView.data,
    });
    return <TodayBriefing view={view} onAction={onAction} />;
};
