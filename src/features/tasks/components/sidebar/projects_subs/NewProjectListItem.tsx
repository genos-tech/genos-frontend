import AddIcon from "@mui/icons-material/Add";

import { NavItem } from "../../../../../components/ui/nav/NavItem";
import type { ProjectManagementState } from "../../../../../hooks/common/useProjectManagement";
import { useTranslation } from "../../../../../i18n";

type NewProjectListItemProps = {
    // Only the "open the create-project modal" setter (MIP-971).
    usePM: Pick<ProjectManagementState, "setOpenCreateProject">;
};
export const NewProjectListItem = (props: NewProjectListItemProps) => {
    const { usePM } = props;
    const { t } = useTranslation();

    return (
        <NavItem
            icon={<AddIcon />}
            label={t.tasks.sidebar.newProject}
            indent={1}
            onClick={() => {
                usePM.setOpenCreateProject(true);
            }}
        />
    );
};
