import { Box } from "@mui/joy";

import { UserAvatar } from "../../../components/ui/avatars/UserAvatar";
import { fmt, useTranslation } from "../../../i18n";
import { g, type } from "../../../theme/tokens";
import { PriorityIcon } from "../../tasks/components/meta/PriorityIcon";
import { StatusLabel } from "../../tasks/components/meta/StatusLabel";
import { taskMetaLabel } from "../../tasks/utils/taskMeta";
import { BAR_STATUSES } from "./barStatuses";
import { Clip, Due, Excerpt, Row } from "./cardParts";
import { factSx, metaSx } from "./cardStyles";
import { MilestoneStatusBar } from "./MilestoneStatusBar";
import type { LiveMilestoneCard } from "./taskCardTypes";

const SHOWN_ASSIGNEES = 3;

/** The middle of a milestone's card: how far its tasks are, who works on it, by when. */
export const MilestoneCardContent = ({ card }: { card: LiveMilestoneCard }) => {
    const { t } = useTranslation();
    const { total, closed, byStatus } = card.progress;
    const present = BAR_STATUSES.filter((status) => (byStatus[status] ?? 0) > 0);
    const breakdown = present
        .map((status) =>
            fmt(t.chat.taskCard.breakdownItem, {
                count: byStatus[status],
                status: taskMetaLabel(status, t.tasks.filters),
            })
        )
        .join(", ");
    const assignees = card.assignees.slice(0, SHOWN_ASSIGNEES);
    return (
        <>
            <Excerpt text={card.excerpt} />
            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, py: 0.25 }}>
                <MilestoneStatusBar
                    byStatus={byStatus}
                    label={
                        total === 0
                            ? t.chat.taskCard.noTasksYet
                            : fmt(t.chat.taskCard.progressAria, { closed, total, breakdown })
                    }
                />
                <Row sx={{ justifyContent: "space-between" }}>
                    <Box component="span" sx={{ ...factSx, fontWeight: 500 }}>
                        {total === 0
                            ? t.chat.taskCard.noTasksYet
                            : fmt(t.chat.taskCard.progress, { closed, total })}
                    </Box>
                    <Row sx={{ columnGap: 1.25 }}>
                        {present.map((status) => (
                            <Box
                                key={status}
                                sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}
                            >
                                <StatusLabel iconSize={12} status={status} iconOnly />
                                <Box component="span" sx={metaSx}>
                                    {byStatus[status]}
                                </Box>
                            </Box>
                        ))}
                    </Row>
                </Row>
            </Box>
            <Row sx={{ minHeight: 24 }}>
                {assignees.length > 0 && (
                    <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}>
                        {assignees.map((person) => (
                            <UserAvatar
                                key={person.userId}
                                clickable={false}
                                fallbackName={person.userName}
                                showPulseDot={false}
                                size="xs"
                                userId={person.userId}
                            />
                        ))}
                        {card.assigneeCount > assignees.length && (
                            <Box
                                component="span"
                                sx={{ ...type("body-xs"), color: g.text.tertiary }}
                            >
                                +{card.assigneeCount - assignees.length}
                            </Box>
                        )}
                    </Box>
                )}
                {card.priority && <PriorityIcon priority={card.priority} size={14} showLabel />}
                <Due
                    done={card.status === "Closed" || card.status === "Deleted"}
                    dueDate={card.dueDate}
                />
                {card.sprint && (
                    <Box component="span" sx={{ ...factSx, display: "inline-flex", minWidth: 0 }}>
                        <Clip max={180}>
                            {fmt(t.chat.taskCard.sprint, { name: card.sprint.name })}
                        </Clip>
                    </Box>
                )}
            </Row>
        </>
    );
};
