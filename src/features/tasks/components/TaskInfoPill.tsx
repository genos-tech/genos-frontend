import AssignmentRoundedIcon from "@mui/icons-material/AssignmentRounded";
import { Box, Typography } from "@mui/joy";
import { alpha } from "@mui/system";

import { AppTooltip } from "../../../components/ui/AppTooltip";
import { fmt, useTranslation } from "../../../i18n";
import { TaskProps } from "../../../types/tasks";
import { formatTaskDisplayId } from "../utils/taskDisplayId";

// The 6 style tokens the pill reads. Both `NoteHeaderActionsStyles` and
// `ThreadChatPaneHeaderStyles` (commonStyle.ts) expose these, so the pill
// renders identically on the task-note header and the chat thread header.
export type TaskInfoPillStyles = {
    chipBg: string;
    chipBorder: string;
    buttonHover: string;
    glowColor: string;
    accentColor: string;
    textColor: string;
};

type TaskInfoPillProps = {
    task: TaskProps;
    onOpen: () => void;
    styles: TaskInfoPillStyles;
    isDark: boolean;
};

/**
 * Unified Task pill — Task #<id> │ Title │ Status badge, all in one
 * rounded shape that is the single "open task" affordance. Lifted out of
 * `NoteHeaderActions` so the chat thread header renders the exact same
 * control (the design the task-note header already uses), instead of a
 * bespoke chip. Status badge is suppressed when status info is missing.
 */
export const TaskInfoPill = ({ task, onOpen, styles, isDark }: TaskInfoPillProps) => {
    const { t } = useTranslation();
    const status = task.status;
    const hasStatus = !!status?.status;
    const statusBg = status?.color ? alpha(status.color, isDark ? 0.4 : 0.6) : "transparent";
    const dotColor = status?.color || styles.accentColor;

    return (
        <AppTooltip
            size="sm"
            title={
                task.title
                    ? fmt(t.notes.header.openTaskTooltipWithTitle, {
                          id: formatTaskDisplayId(task),
                          title: task.title,
                      })
                    : fmt(t.notes.header.openTaskTooltip, {
                          id: formatTaskDisplayId(task),
                      })
            }
        >
            <Box
                component="button"
                type="button"
                aria-label={
                    task.title
                        ? fmt(t.notes.header.openTaskAriaWithTitle, {
                              id: formatTaskDisplayId(task),
                              title: task.title,
                          })
                        : fmt(t.notes.header.openTaskAria, {
                              id: formatTaskDisplayId(task),
                          })
                }
                sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 0.75,
                    height: 32,
                    px: 1.25,
                    borderRadius: "10px",
                    border: `1px solid ${styles.chipBorder}`,
                    background: styles.chipBg,
                    cursor: "pointer",
                    font: "inherit",
                    color: styles.textColor,
                    transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                    "&:hover": {
                        background: styles.buttonHover,
                        transform: "translateY(-1px)",
                        boxShadow: `0 4px 12px ${styles.glowColor}`,
                    },
                    "&:focus-visible": {
                        outline: `2px solid ${styles.accentColor}`,
                        outlineOffset: 2,
                    },
                }}
                onClick={onOpen}
            >
                {/* ID section */}
                <AssignmentRoundedIcon sx={{ fontSize: 16, color: styles.accentColor }} />
                <Typography
                    level="body-xs"
                    sx={{
                        fontWeight: 700,
                        color: styles.accentColor,
                        letterSpacing: "-0.01em",
                        whiteSpace: "nowrap",
                    }}
                >
                    {fmt(t.notes.header.taskIdLabel, {
                        id: formatTaskDisplayId(task),
                    })}
                </Typography>

                {/* Title section */}
                {task.title ? (
                    <>
                        <Box
                            sx={{
                                width: "1px",
                                height: 14,
                                bgcolor: styles.chipBorder,
                                mx: 0.25,
                            }}
                        />
                        <Typography
                            level="body-xs"
                            sx={{
                                fontWeight: 600,
                                color: styles.textColor,
                                maxWidth: 180,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                letterSpacing: "-0.01em",
                            }}
                        >
                            {task.title}
                        </Typography>
                    </>
                ) : null}

                {/* Status section */}
                {hasStatus && (
                    <>
                        <Box
                            sx={{
                                width: "1px",
                                height: 14,
                                bgcolor: styles.chipBorder,
                                mx: 0.25,
                            }}
                        />
                        <Box
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 0.5,
                                px: 0.75,
                                py: 0.125,
                                borderRadius: "6px",
                                background: statusBg,
                                color: status?.textColor || "#fff",
                            }}
                        >
                            <Box
                                sx={{
                                    width: 6,
                                    height: 6,
                                    borderRadius: "50%",
                                    background: dotColor,
                                    boxShadow: `0 0 0 2px ${alpha(dotColor, isDark ? 0.25 : 0.18)}`,
                                }}
                            />
                            <Typography
                                level="body-xs"
                                sx={{
                                    fontWeight: 700,
                                    color: "inherit",
                                    fontSize: "11px",
                                    textTransform: "uppercase",
                                    letterSpacing: "0.04em",
                                }}
                            >
                                {status?.status}
                            </Typography>
                        </Box>
                    </>
                )}
            </Box>
        </AppTooltip>
    );
};
