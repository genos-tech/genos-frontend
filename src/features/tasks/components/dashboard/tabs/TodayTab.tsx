import { TodayBriefing } from "../../../../today/TodayBriefing";
import type { TaskHomeData } from "../useTaskHomeData";

type TodayTabProps = Pick<TaskHomeData, "todayView">;

export const TodayTab = ({ todayView }: TodayTabProps) => {
    return <TodayBriefing view={todayView} />;
};
