import { memo } from "react";
import ViewKanbanIcon from "@mui/icons-material/ViewKanban";

import { NavItem } from "../../../../components/ui/nav/NavItem";
import { useTranslation } from "../../../../i18n";
import type { SidebarBoardViewTM } from "./useSidebarSlices";

type SprintBoardListItemProps = {
    // Its own flag and the three view setters (MIP-971), not the whole manager.
    useTM: SidebarBoardViewTM;
};

export const SprintBoardListItem = memo(function SprintBoardListItem(
    props: SprintBoardListItemProps
) {
    const { useTM } = props;
    const isSelected = useTM.isSprintBoardVisible === true;
    const { t } = useTranslation();

    return (
        <NavItem
            icon={<ViewKanbanIcon />}
            label={t.tasks.sidebar.board}
            selected={isSelected}
            onClick={() => {
                useTM.setIsTaskDashboardVisible(false);
                useTM.setIsTaskTableVisible(false);
                useTM.setIsSprintBoardVisible(true);
            }}
        />
    );
});
