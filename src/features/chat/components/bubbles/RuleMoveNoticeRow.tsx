import { Fragment } from "react";
import { Box, Typography } from "@mui/joy";

import { PROJECT_PALETTE, TASK_PALETTE } from "../../../../components/editors/mentionPalettes";
import { LightHashChip } from "../../../../components/messageBody/LightMessageBody";
import { useTranslation } from "../../../../i18n";
import { g } from "../../../../theme/tokens";
import type { RuleMoveNotice } from "../../../../types/chat";
import { entityRefToHref } from "../../../../utils/entityHref";
import { useRuleMoveRefs } from "../../hooks/useRuleMoveRefs";

/**
 * The one line a project rule leaves in the old project's chat (MIP-2500): no bubble, no author,
 * no actions. The task and the project are links only for a viewer who may open them.
 */
export const RuleMoveNoticeRow = ({ notice }: { notice: RuleMoveNotice }) => {
    const { t } = useTranslation();
    const { projectName, task } = useRuleMoveRefs(notice);
    const copy = t.chat.ruleMoveNotice;

    const taskLabel = task && [task.displayId, task.title].filter(Boolean).join(" · ");

    // The template is split BEFORE the rule's name goes in, so a name cannot add a placeholder.
    const parts = copy.line.split(/(\{task\}|\{project\})/);

    return (
        <Box data-rule-move-notice="" sx={{ width: "100%", textAlign: "center", px: 2, py: 1 }}>
            <Typography level="body-sm" sx={{ color: g.text.secondary, overflowWrap: "anywhere" }}>
                {parts.map((part, index) => {
                    if (part === "{task}") {
                        return taskLabel ? (
                            <bdi key={index}>
                                <LightHashChip
                                    label={taskLabel}
                                    palette={TASK_PALETTE}
                                    href={entityRefToHref({
                                        entityType: "task",
                                        projectId: String(notice.projectId),
                                        taskId: String(notice.taskId),
                                    })}
                                />
                            </bdi>
                        ) : (
                            <Fragment key={index}>{copy.aTask}</Fragment>
                        );
                    }
                    if (part === "{project}") {
                        return projectName ? (
                            <bdi key={index}>
                                <LightHashChip
                                    label={projectName}
                                    palette={PROJECT_PALETTE}
                                    href={entityRefToHref({
                                        entityType: "project",
                                        projectId: String(notice.projectId),
                                    })}
                                />
                            </bdi>
                        ) : (
                            <Fragment key={index}>{copy.anotherProject}</Fragment>
                        );
                    }
                    // The rule's name, in the text around the two names.
                    return (
                        <Fragment key={index}>
                            {part.split("{rule}").map((text, i) => (
                                <Fragment key={i}>
                                    {i > 0 ? <bdi>{notice.ruleName}</bdi> : null}
                                    {text}
                                </Fragment>
                            ))}
                        </Fragment>
                    );
                })}
            </Typography>
        </Box>
    );
};
