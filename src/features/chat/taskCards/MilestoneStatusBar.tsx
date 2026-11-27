import { Box } from "@mui/joy";

import { g } from "../../../theme/tokens";
import {
    STATUS_BLOCKED,
    STATUS_CLOSED,
    STATUS_OPEN,
    STATUS_PENDING,
    STATUS_WIP,
} from "../../tasks/meta/taskStatuses";
import { BAR_STATUSES } from "./barStatuses";

const FILL: Record<(typeof BAR_STATUSES)[number], string> = {
    [STATUS_CLOSED]: g.success.solid,
    [STATUS_WIP]: g.warning.solid,
    [STATUS_BLOCKED]: g.danger.solid,
    [STATUS_PENDING]: g.text.tertiary,
    [STATUS_OPEN]: g.info.border,
};

/** A milestone's tasks as one bar, each status as wide as its share. */
export const MilestoneStatusBar = ({
    byStatus,
    label,
}: {
    byStatus: Record<string, number>;
    label: string;
}) => (
    <Box
        aria-label={label}
        data-testid="milestone-status-bar"
        role="img"
        sx={{
            display: "flex",
            gap: "2px",
            height: 6,
            overflow: "hidden",
            borderRadius: g.radius.full,
            bgcolor: g.border.subtle,
        }}
    >
        {BAR_STATUSES.filter((status) => (byStatus[status] ?? 0) > 0).map((status) => (
            <Box
                key={status}
                data-status={status}
                sx={{
                    flexGrow: byStatus[status],
                    flexBasis: 0,
                    minWidth: 4,
                    bgcolor: FILL[status],
                    transition: `flex-grow ${g.motion.base}`,
                    "@media (prefers-reduced-motion: reduce)": { transition: "none" },
                }}
            />
        ))}
    </Box>
);
