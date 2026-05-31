import { Box, Stack, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";

import { useTranslation } from "../../../../i18n";
import { UserProps } from "../../../../types/admin";
import { extractMMDDHHMMSSs } from "../../../../utils/dateUtils";
import { formatTaskDisplayId } from "../../../tasks/utils/taskDisplayId";
import { statuses } from "../../../tasks/utils/taskMeta";

// Status chip color configuration - improved for better visibility
const getStatusChipStyles = (
    taskStatusDetails: { color?: string | null; textColor?: string | null } | undefined,
    isDark: boolean
) => {
    if (!taskStatusDetails?.color) {
        return {
            background: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)",
            color: isDark ? "#e2e8f0" : "#1e293b",
            borderColor: isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.15)",
        };
    }

    const baseColor = taskStatusDetails.color;
    // For light mode, use darker background and ensure text is visible
    return {
        background: isDark
            ? `linear-gradient(135deg, ${baseColor}40 0%, ${baseColor}25 100%)`
            : `${baseColor}`,
        color: isDark ? "#ffffff" : taskStatusDetails.textColor || "#ffffff",
        borderColor: isDark ? `${baseColor}60` : `${baseColor}`,
    };
};

type BubbleUserNameTypes = {
    isSimpleBubble: boolean;
    sender: UserProps;
    chatType: number;
    userName: string;
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
        userName,
        isSent,
        dtSent,
        tsSent,
        tsUpdated,
        taskId,
        displayId,
        taskStatus,
        isThread,
    } = props;

    const { mode } = useColorScheme();
    const { t } = useTranslation();
    const isDark = mode === "dark";
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

    // Modern chip component with improved visibility
    const ModernChip = ({
        children,
        variant = "neutral",
        customStyles,
    }: {
        children: React.ReactNode;
        variant?: "neutral" | "status";
        customStyles?: Record<string, any>;
    }) => (
        <Box
            sx={{
                display: "inline-flex",
                alignItems: "center",
                height: 24,
                px: 1,
                borderRadius: "6px",
                fontSize: "0.75rem",
                fontWeight: 700,
                letterSpacing: "0.01em",
                border: "1px solid",
                transition: "all 0.15s ease",
                ...(variant === "neutral"
                    ? {
                          // Improved neutral chip with better contrast
                          background: isDark
                              ? "linear-gradient(135deg, rgba(124,58,237,0.25) 0%, rgba(124,58,237,0.15) 100%)"
                              : "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)",
                          color: isDark ? "#f3e8ff" : "#ffffff",
                          borderColor: isDark ? "rgba(124,58,237,0.4)" : "#6d28d9",
                      }
                    : customStyles),
            }}
        >
            {children}
        </Box>
    );

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
                        direction="row"
                        alignItems="center"
                        spacing={0.75}
                        sx={{ flexWrap: "wrap", gap: 0.5 }}
                    >
                        {/* Display-id chip only when this bubble actually
                            references a task. Orphan PM rows (no `taskId`)
                            still render in the card layout but skip the
                            chips so the header stays just the date. */}
                        {isThread === false && taskId !== null && (
                            <ModernChip>
                                {formatTaskDisplayId({ taskId, displayId }) || "N/A"}
                            </ModernChip>
                        )}

                        {taskId !== null && taskStatusDetails && (
                            <ModernChip
                                variant="status"
                                customStyles={getStatusChipStyles(taskStatusDetails, isDark)}
                            >
                                {taskStatus || "N/A"}
                            </ModernChip>
                        )}

                        <Typography
                            level="body-xs"
                            sx={{
                                fontWeight: 500,
                                fontSize: "0.7rem",
                                color: isDark ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.55)",
                                letterSpacing: "0.02em",
                            }}
                        >
                            {isEdited ? (
                                <>
                                    {dtSent} {isThread ? "" : t.chat.bubble.updated}
                                </>
                            ) : (
                                dtSent
                            )}
                        </Typography>
                    </Stack>
                )}

                {/* Message bubble for normal users (not task cards) */}
                {!renderAsTaskCard && (
                    <Stack direction="row" alignItems="center" spacing={1}>
                        {isSimpleBubble === false && (
                            <Typography
                                level="body-sm"
                                sx={{
                                    fontWeight: 600,
                                    fontSize: "0.85rem",
                                    color: isDark ? "#f1f5f9" : "#0f172a",
                                    letterSpacing: "-0.01em",
                                }}
                            >
                                {userName}
                            </Typography>
                        )}

                        <Typography
                            level="body-xs"
                            sx={{
                                fontWeight: 500,
                                fontSize: "0.7rem",
                                color: isDark ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.5)",
                                letterSpacing: "0.02em",
                                pt: isSimpleBubble ? 0.5 : 0,
                            }}
                        >
                            {isEdited ? `${dtSent} Edited` : dtSent}
                        </Typography>
                    </Stack>
                )}
            </Stack>
        </Box>
    );
};
