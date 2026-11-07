import { Box, Stack } from "@mui/joy";

import { ResolvedUserName } from "../../../../components/ui/avatars/AvatarContext";
import { BubbleAuthor, BubbleMeta } from "../../../../components/ui/bubble";
import { useTranslation } from "../../../../i18n";
import { g, type } from "../../../../theme/tokens";
import { UserProps } from "../../../../types/admin";
import { extractMMDDHHMMSSs } from "../../../../utils/dateUtils";
import { StatusLabel } from "../../../tasks/components/meta/StatusLabel";
import { formatTaskDisplayId } from "../../../tasks/utils/taskDisplayId";
import { statuses } from "../../../tasks/utils/taskMeta";

// The task's display id: a quiet accent chip. (The status is the shared
// StatusLabel: its color is in the icon.)
const IdChip = ({ children }: { children: React.ReactNode }) => (
    <Box
        sx={{
            ...type("title-sm"),
            display: "inline-flex",
            alignItems: "center",
            height: 24,
            px: 1,
            borderRadius: g.radius.sm,
            border: "1px solid",
            borderColor: g.accent.border,
            bgcolor: g.accent.subtle,
            color: g.accent.text,
        }}
    >
        {children}
    </Box>
);

type BubbleUserNameTypes = {
    isSimpleBubble: boolean;
    sender: UserProps;
    chatType: number;
    isSent: boolean;
    dtSent: string;
    tsSent: string;
    tsUpdated: string;
    taskId: number | null;
    // Human-readable task identifier ("GEN-42"); falls back via
    // `formatTaskDisplayId` to "#<taskId>" when absent.
    displayId?: string | null;
    taskStatus: string | null;
    isThread: boolean;
};

export const BubbleUserName = (props: BubbleUserNameTypes) => {
    const {
        isSimpleBubble,
        sender,
        chatType,
        isSent,
        dtSent,
        tsSent,
        tsUpdated,
        taskId,
        displayId,
        taskStatus,
        isThread,
    } = props;

    const { t } = useTranslation();
    const taskStatusDetails = statuses.find((item) => item.status === taskStatus);
    const isEdited = extractMMDDHHMMSSs(tsSent) !== extractMMDDHHMMSSs(tsUpdated);
    // Render the task-card header (display-id chip + status chip + date)
    // whenever:
    //   - the sender is the project's system user, OR
    //   - the bubble is a PM linked to a task. The legacy task-creation
    //     path stamped `PMMessages.sender_id` to whoever created the
    //     task, and that backfilled through to v3 `Message.sender_id`,
    //     so the system-user check alone would render those bubbles
    //     with the creator's userName instead of task chips. The
    //     v3 adapter filters out PM messages without a `taskId`, so
    //     any PM that reaches this renderer is a real task header.
    const renderAsTaskCard = sender.isSystemUser === true || (chatType === 3 && taskId !== null);

    return (
        <Box sx={{ flex: 1 }}>
            <Stack
                alignItems="flex-start"
                direction="column"
                justifyContent={isSent ? "flex-end" : "flex-start"}
                spacing={0.25}
            >
                {/* Task-card header (system user OR PM bubble) */}
                {renderAsTaskCard && (
                    <Stack
                        alignItems="center"
                        direction="row"
                        spacing={0.75}
                        sx={{ flexWrap: "wrap", gap: 0.5 }}
                    >
                        {/* Display-id chip only when this bubble actually
                            references a task. Orphan PM rows (no `taskId`)
                            still render in the card layout but skip the
                            chips so the header stays just the date. */}
                        {isThread === false && taskId !== null && (
                            <IdChip>
                                {formatTaskDisplayId({ taskId, displayId }) ||
                                    t.chat.modals.gmProfile.na}
                            </IdChip>
                        )}

                        {taskId !== null && taskStatusDetails && (
                            <StatusLabel status={taskStatus} />
                        )}

                        <BubbleMeta>
                            {isEdited ? (
                                <>
                                    {dtSent} {isThread ? "" : t.chat.bubble.updated}
                                </>
                            ) : (
                                dtSent
                            )}
                        </BubbleMeta>
                    </Stack>
                )}

                {/* Message bubble for normal users (not task cards) */}
                {!renderAsTaskCard && (
                    <Stack alignItems="center" direction="row" spacing={1}>
                        {isSimpleBubble === false && (
                            <BubbleAuthor>
                                {/* Live-resolve the sender's current name in
                                    this leaf so the AvatarContext
                                    subscription is isolated here — the
                                    memoized parent bubble no longer
                                    re-renders on `teamMemberProfiles` churn.
                                    Falls back to the name frozen on the
                                    message when the sender is in no roster. */}
                                <ResolvedUserName
                                    fallbackName={sender.userName}
                                    userId={sender.userId}
                                />
                            </BubbleAuthor>
                        )}

                        <BubbleMeta sx={{ pt: isSimpleBubble ? 0.5 : 0 }}>
                            {isEdited ? `${dtSent} ${t.chat.bubble.edited}` : dtSent}
                        </BubbleMeta>
                    </Stack>
                )}
            </Stack>
        </Box>
    );
};
