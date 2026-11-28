import { Box } from "@mui/joy";

import { useProjectStatuses } from "../../../../hooks/tasks/useProjectStatuses";
import { resolveStatusRow } from "../../utils/projectStatus";
import { StatusLabel } from "../meta/StatusLabel";

/**
 * A board card's status, only when its column does not already say it (MIP-2493): the card
 * reads as one of the project's statuses other than the category's default. A project
 * without statuses draws nothing, and the card is as it was.
 */
export const CardStatusMark = ({
    projectId,
    status,
    customStatusId,
}: {
    projectId?: number | null;
    status?: string | null;
    customStatusId?: number | null;
}) => {
    const { statuses } = useProjectStatuses(projectId, customStatusId);
    const row = resolveStatusRow(statuses, status, customStatusId);
    if (!row || row.isDefault) return null;
    return (
        <Box data-testid="card-status-mark" sx={{ display: "flex", minWidth: 0 }}>
            <StatusLabel iconSize={12} row={row} status={row.category} />
        </Box>
    );
};
