/**
 * A project-chat task or milestone message as a card of the task AS IT IS NOW (MIP-2484),
 * in the viewer's language. The stored message body is not read while the card shows; it is
 * the `fallback` for a task that is gone, that this viewer may not open, or that could not
 * be loaded, so those read exactly as they always did.
 *
 * The whole card is one control that opens the task. Reactions, the comment count and the
 * toolbar belong to the bubble around it.
 */

import { memo, ReactNode, SyntheticEvent, useId } from "react";
import { Box } from "@mui/joy";

import { Clickable } from "../../../components/ui/Clickable";
import { fmt, useTranslation } from "../../../i18n";
import { g } from "../../../theme/tokens";
import { formatTaskDisplayId } from "../../tasks/utils/taskDisplayId";
import type { ViaApp } from "../../tasks/utils/viaSource";
import { CardFooter, CardHeader, CardTitle } from "./cardParts";
import { MilestoneCardContent } from "./MilestoneCardContent";
import { TaskCardContent } from "./TaskCardContent";
import type { LiveCard } from "./taskCardTypes";
import { useLiveTaskCard } from "./useLiveTaskCard";

type TaskMessageCardProps = {
    taskId: number;
    viewerId: string;
    /** The message's own values, shown until the live ones arrive. */
    seedTitle: string;
    seedDisplayId?: string | null;
    seedStatus?: string | null;
    sentAt: string;
    messageUpdatedAt: string;
    viaApp?: ViaApp;
    /** Draw the card's own surface: where the message around it has none (compact). */
    framed: boolean;
    /** `card` is the live task, once read (its project, for opening it elsewhere). */
    onOpen: (event: SyntheticEvent<HTMLElement>, card?: LiveCard) => void;
    /** The message as it is drawn without a card. */
    fallback: ReactNode;
};

const TaskMessageCardImpl = (props: TaskMessageCardProps) => {
    const { taskId, viewerId, messageUpdatedAt, framed, onOpen, fallback } = props;
    const { t } = useTranslation();
    const entry = useLiveTaskCard(taskId, messageUpdatedAt, viewerId);
    const factsId = useId();
    if (entry?.status === "gone" || entry?.status === "error") return <>{fallback}</>;

    const card = entry?.data;
    const isMilestone = card?.kind === "milestone";
    const title = card?.title ?? props.seedTitle;
    const displayId =
        card?.displayId ?? formatTaskDisplayId({ taskId, displayId: props.seedDisplayId });

    return (
        <Clickable
            aria-busy={card ? undefined : true}
            // The name is short; where the task stands is read as its description.
            aria-describedby={card ? factsId : undefined}
            data-testid="task-message-card"
            label={fmt(
                isMilestone ? t.chat.taskCard.openMilestoneLabel : t.chat.taskCard.openTaskLabel,
                { id: displayId, title }
            )}
            sx={{
                display: "flex",
                flexDirection: "column",
                gap: 0.75,
                minWidth: 0,
                textAlign: "start",
                ...(framed
                    ? {
                          maxWidth: 640,
                          p: 1.25,
                          bgcolor: g.surface.default,
                          border: "1px solid",
                          borderColor: g.border.default,
                          "&:hover": { borderColor: g.border.strong },
                      }
                    : {}),
                borderRadius: g.radius.md,
            }}
            onActivate={(event) => {
                // One path opens the task; the bubble's own click must not run it again.
                event.stopPropagation();
                onOpen(event, card);
            }}
        >
            <Box id={factsId} sx={{ display: "contents" }}>
                <CardHeader
                    displayId={displayId}
                    isMilestone={isMilestone}
                    sentAt={props.sentAt}
                    status={card?.status ?? props.seedStatus}
                    viaApp={props.viaApp}
                />
                <CardTitle>{title}</CardTitle>
                {card ? (
                    <>
                        {card.kind === "milestone" ? (
                            <MilestoneCardContent card={card} />
                        ) : (
                            <TaskCardContent card={card} />
                        )}
                        <CardFooter
                            createdAt={card.createdAt}
                            creator={card.reporter}
                            updatedAt={card.updatedAt}
                        />
                    </>
                ) : (
                    // The facts row's own height, so little moves when they arrive.
                    <Box
                        sx={{ display: "flex", gap: 1.5, alignItems: "center", height: 24 }}
                        title={t.chat.taskCard.loading}
                    >
                        {[96, 64, 80].map((width) => (
                            <Box
                                key={width}
                                sx={{
                                    width,
                                    height: 10,
                                    borderRadius: g.radius.xs,
                                    bgcolor: g.hover,
                                }}
                            />
                        ))}
                    </Box>
                )}
            </Box>
        </Clickable>
    );
};

export const TaskMessageCard = memo(TaskMessageCardImpl);
