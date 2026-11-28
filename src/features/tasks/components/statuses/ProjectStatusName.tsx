import { useProjectStatuses } from "../../../../hooks/tasks/useProjectStatuses";
import { useTranslation } from "../../../../i18n";
import { resolveStatusRow, statusRowName } from "../../utils/projectStatus";
import { taskMetaLabel } from "../../utils/taskMeta";

/** What the project calls this status, as text alone: for a chip that keeps its own color
 *  (the milestone rows' category chip, MIP-2495). */
export const ProjectStatusName = ({
    projectId,
    status,
    customStatusId,
}: {
    projectId?: number | null;
    status: string;
    customStatusId?: number | null;
}) => {
    const { t } = useTranslation();
    const { statuses } = useProjectStatuses(projectId, customStatusId);
    const row = resolveStatusRow(statuses, status, customStatusId);
    const name = row
        ? statusRowName(row, t.tasks)
        : taskMetaLabel(status, t.tasks.filters) || status;
    return (
        <span
            title={name}
            style={{
                display: "block",
                maxWidth: 96,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
            }}
        >
            {name}
        </span>
    );
};
