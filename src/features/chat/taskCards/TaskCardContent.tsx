import BlockRoundedIcon from "@mui/icons-material/BlockRounded";
import { Box } from "@mui/joy";

import { fmt, useTranslation } from "../../../i18n";
import { g, type } from "../../../theme/tokens";
import { MilestoneFlag } from "../../tasks/components/card/parts";
import { PriorityIcon } from "../../tasks/components/meta/PriorityIcon";
import { Tag } from "../../tasks/components/meta/Tag";
import { isDone } from "./barStatuses";
import { Clip, Due, Excerpt, Person, Row } from "./cardParts";
import { factSx, metaSx } from "./cardStyles";
import type { LiveTaskCard } from "./taskCardTypes";

const SHOWN_TAGS = 3;

/** The middle of a task's card: what it is, who has it, when, and where it sits. */
export const TaskCardContent = ({ card }: { card: LiveTaskCard }) => {
    const { t } = useTranslation();
    const blocker = card.blockedBy[0];
    const tags = card.tags.slice(0, SHOWN_TAGS);
    const place = card.milestone ?? card.parent;
    return (
        <>
            <Excerpt text={card.excerpt} />
            <Row sx={{ minHeight: 24 }}>
                <Person person={card.assignee} />
                {card.priority && <PriorityIcon priority={card.priority} size={14} showLabel />}
                <Due done={isDone(card.status)} dueDate={card.dueDate} />
                {place && (
                    <Box
                        sx={{
                            ...factSx,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 0.5,
                            minWidth: 0,
                            maxWidth: "100%",
                        }}
                        title={fmt(
                            card.milestone
                                ? t.chat.taskCard.inMilestone
                                : t.chat.taskCard.subtaskOf,
                            { title: place.title, task: place.title }
                        )}
                    >
                        {card.milestone ? (
                            <>
                                <MilestoneFlag size={12} />
                                <Clip max={220}>{place.title}</Clip>
                            </>
                        ) : (
                            <Clip max={260}>
                                {fmt(t.chat.taskCard.subtaskOf, { task: place.displayId })}
                            </Clip>
                        )}
                    </Box>
                )}
            </Row>
            {card.status === "Blocked" && blocker && (
                <Box
                    sx={{
                        ...factSx,
                        display: "flex",
                        alignItems: "center",
                        gap: 0.5,
                        minWidth: 0,
                    }}
                >
                    <BlockRoundedIcon
                        aria-hidden="true"
                        sx={{ fontSize: 12, color: g.danger.text, "--Icon-color": g.danger.text }}
                    />
                    <Clip>
                        {fmt(t.chat.taskCard.blockedBy, {
                            task: `${blocker.displayId} ${blocker.title}`,
                        })}
                    </Clip>
                    {card.blockedByCount > 1 && (
                        <Box component="span" sx={{ ...metaSx, flexShrink: 0 }}>
                            +{card.blockedByCount - 1}
                        </Box>
                    )}
                </Box>
            )}
            {tags.length > 0 && (
                <Row sx={{ columnGap: 0.5 }}>
                    {tags.map((tag) => (
                        <Tag key={tag.tagName} color={tag.tagColor} label={tag.tagName} />
                    ))}
                    {card.tagCount > tags.length && (
                        <Box component="span" sx={{ ...type("body-xs"), color: g.text.tertiary }}>
                            +{card.tagCount - tags.length}
                        </Box>
                    )}
                </Row>
            )}
        </>
    );
};
