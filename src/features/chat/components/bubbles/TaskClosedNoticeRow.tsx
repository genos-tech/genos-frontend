import { Fragment } from "react";
import { Box, Typography } from "@mui/joy";

import { useTranslation } from "../../../../i18n";
import { g } from "../../../../theme/tokens";
import { taskMetaLabel } from "../../../tasks/utils/taskMeta";

/**
 * "Task PRJ-12 is now Closed." in the reader's language (MIP-2553): no bubble, no author, no
 * actions, as the rule-moved line (`RuleMoveNoticeRow`).
 */
export const TaskClosedNoticeRow = ({ displayId }: { displayId: string }) => {
    const { t } = useTranslation();
    const parts = t.chat.taskClosedNotice
        .replace("{status}", taskMetaLabel("Closed", t.tasks.filters))
        .split("{task}");

    return (
        <Box data-task-closed-notice="" sx={{ width: "100%", textAlign: "center", px: 2, py: 1 }}>
            <Typography level="body-sm" sx={{ color: g.text.secondary, overflowWrap: "anywhere" }}>
                {parts.map((part, index) => (
                    <Fragment key={index}>
                        {index > 0 ? <bdi>{displayId}</bdi> : null}
                        {part}
                    </Fragment>
                ))}
            </Typography>
        </Box>
    );
};
