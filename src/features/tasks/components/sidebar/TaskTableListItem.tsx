import { memo } from "react";
import TableChartIcon from "@mui/icons-material/TableChart";

import { NavItem } from "../../../../components/ui/nav/NavItem";
import { useTranslation } from "../../../../i18n";
import type { SidebarTableViewTM } from "./useSidebarSlices";

type TaskTableListItemProps = {
    // Its own flag and the three view setters (MIP-971), not the whole manager.
    useTM: SidebarTableViewTM;
};

export const TaskTableListItem = memo(function TaskTableListItem(props: TaskTableListItemProps) {
    const { useTM } = props;
    const isSelected = useTM.isTaskTableVisible === true;
    const { t } = useTranslation();

    return (
        <NavItem
            icon={<TableChartIcon />}
            label={t.tasks.sidebar.table}
            selected={isSelected}
            onClick={() => {
                useTM.setIsTaskDashboardVisible(false);
                useTM.setIsSprintBoardVisible(false);
                useTM.setIsTaskTableVisible(true);
            }}
        />
    );
});
