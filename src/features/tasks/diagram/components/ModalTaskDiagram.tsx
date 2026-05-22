import { useState } from "react";
import AccountTreeRoundedIcon from "@mui/icons-material/AccountTreeRounded";
import CalendarMonthRoundedIcon from "@mui/icons-material/CalendarMonthRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import {
    Box,
    Chip,
    IconButton,
    LinearProgress,
    Modal,
    ModalDialog,
    Stack,
    Tooltip,
    Typography,
} from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";

import { ProjectManagementState } from "../../../../hooks/common/useProjectManagement";
import { TaskManagementState } from "../../../../hooks/tasks/useTaskManagement";
import { purplePalette } from "../../../../theme/purplePalette";
import { UserProps } from "../../../../types/admin";
import { ScheduleOverview } from "../types";
import { TaskFlowCanvas } from "./TaskFlowCanvas";

type Props = {
    open: boolean;
    onClose: () => void;
    myself: UserProps;
    /** Root task or milestone-backing task — defines what tree is drawn. */
    rootTaskId: number;
    /** Required so we can fetch project tasks in one call. */
    projectId: number;
    /** Header title — typically "<displayId> · <title>". */
    rootLabel: string;
    useTM: TaskManagementState;
    /** Needed so a click on an external ghost can switch the current
     *  project before opening that task's preview. */
    usePM: ProjectManagementState;
};

// Full-screen diagram modal. Substantially larger than every other
// modal in the codebase (the largest, SettingsModal, tops out at
// ~700px). Graphs need real estate; we go to 94vw × 90vh so the
// dagre tree has room to breathe. The chrome (header + close) is
// kept minimal so the canvas dominates.
const fmtDateLabel = (iso: string | null): string | null => {
    if (!iso) return null;
    const d = new Date(iso.length >= 10 ? iso.slice(0, 10) : iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

export const ModalTaskDiagram = ({
    open,
    onClose,
    myself,
    rootTaskId,
    projectId,
    rootLabel,
    useTM,
    usePM,
}: Props) => {
    const { mode } = useColorScheme();
    const isDark = mode === "dark";
    const P = isDark ? purplePalette.dark : purplePalette.light;

    // Schedule rollup published by the canvas after each graph load.
    // Null while the first load is in flight.
    const [overview, setOverview] = useState<ScheduleOverview | null>(null);

    const spanLabel = (() => {
        if (!overview) return null;
        const start = fmtDateLabel(overview.spanStart);
        const end = fmtDateLabel(overview.spanEnd);
        if (start && end) return `${start} – ${end}`;
        return start ?? end ?? null;
    })();
    const progressPct =
        overview && overview.total > 0
            ? Math.round((overview.closed / overview.total) * 100)
            : null;
    const showOverview =
        overview != null &&
        (spanLabel != null || overview.spanDays != null || overview.total > 0);

    return (
        <Modal open={open} onClose={onClose}>
            <ModalDialog
                size="lg"
                variant="outlined"
                sx={{
                    width: "94vw",
                    height: "90vh",
                    maxWidth: "none",
                    maxHeight: "none",
                    p: 0,
                    display: "flex",
                    flexDirection: "column",
                    overflow: "hidden",
                    background: P.surface,
                    border: "1px solid",
                    borderColor: P.border,
                    borderRadius: "16px",
                    boxShadow: P.shadow,
                }}
            >
                {/* Accent strip — visual sibling of the
                    ModalManageDependencies treatment, but purple to
                    flag the diagram as the design-system's "tree" view */}
                <Box
                    sx={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        height: "3px",
                        background:
                            "linear-gradient(90deg, #a78bfa 0%, #8b5cf6 50%, #c084fc 100%)",
                        opacity: 0.85,
                        borderRadius: "16px 16px 0 0",
                    }}
                />

                {/* Header */}
                <Stack
                    direction="row"
                    alignItems="center"
                    spacing={1.25}
                    sx={{
                        px: 2.5,
                        pt: 2,
                        pb: 1.25,
                        borderBottom: "1px solid",
                        borderColor: P.border,
                        flexShrink: 0,
                    }}
                >
                    <Box
                        sx={{
                            width: 32,
                            height: 32,
                            borderRadius: "8px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            background: P.hoverBg,
                            color: P.accentSoft,
                        }}
                    >
                        <AccountTreeRoundedIcon sx={{ fontSize: 20 }} />
                    </Box>
                    <Stack spacing={0} sx={{ minWidth: 0, flex: 1 }}>
                        <Typography level="title-md" sx={{ fontWeight: 700, color: P.text }}>
                            Task graph
                        </Typography>
                        <Typography
                            level="body-xs"
                            sx={{
                                color: P.textMuted,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                            }}
                        >
                            {rootLabel}
                        </Typography>
                    </Stack>

                    {/* Schedule overview pill — only renders when at
                        least one of (span, progress) is computable.
                        Tries to read as a quick at-a-glance summary
                        for the milestone or sub-tree. */}
                    {showOverview && (
                        <Stack
                            direction="row"
                            alignItems="center"
                            spacing={1.5}
                            sx={{
                                px: 1.5,
                                py: 0.75,
                                borderRadius: "10px",
                                background: P.surfaceElevated,
                                border: `1px solid ${P.border}`,
                            }}
                        >
                            {spanLabel && (
                                <Stack direction="row" alignItems="center" spacing={0.6}>
                                    <CalendarMonthRoundedIcon
                                        sx={{ fontSize: 16, color: P.textMuted, opacity: 0.85 }}
                                    />
                                    <Typography
                                        level="body-sm"
                                        sx={{ color: P.text, fontWeight: 600 }}
                                    >
                                        {spanLabel}
                                    </Typography>
                                    {overview?.spanDays != null && (
                                        <Chip
                                            size="sm"
                                            variant="outlined"
                                            sx={{
                                                fontSize: "0.65rem",
                                                fontWeight: 600,
                                                borderRadius: "5px",
                                                color: P.textMuted,
                                            }}
                                        >
                                            {overview.spanDays}d
                                        </Chip>
                                    )}
                                </Stack>
                            )}
                            {progressPct != null && overview && (
                                <Stack
                                    direction="row"
                                    alignItems="center"
                                    spacing={0.75}
                                    sx={{ minWidth: 140 }}
                                >
                                    <Box sx={{ flex: 1, minWidth: 60 }}>
                                        <LinearProgress
                                            determinate
                                            value={progressPct}
                                            size="sm"
                                            color={progressPct === 100 ? "success" : "primary"}
                                            sx={{ "--LinearProgress-thickness": "6px" }}
                                        />
                                    </Box>
                                    <Typography
                                        level="body-xs"
                                        sx={{
                                            color: P.textMuted,
                                            fontWeight: 600,
                                            whiteSpace: "nowrap",
                                        }}
                                    >
                                        {overview.closed}/{overview.total}
                                    </Typography>
                                </Stack>
                            )}
                        </Stack>
                    )}

                    <Tooltip title="Close" placement="left" variant="outlined" arrow>
                        <IconButton
                            variant="plain"
                            color="neutral"
                            size="sm"
                            onClick={onClose}
                            sx={{ color: P.textMuted, "&:hover": { color: P.text } }}
                        >
                            <CloseRoundedIcon />
                        </IconButton>
                    </Tooltip>
                </Stack>

                {/* Canvas fills the rest of the dialog */}
                <Box sx={{ flex: 1, display: "flex", minHeight: 0 }}>
                    {open && (
                        <TaskFlowCanvas
                            myself={myself}
                            rootTaskId={rootTaskId}
                            projectId={projectId}
                            useTM={useTM}
                            usePM={usePM}
                            onOverviewChange={setOverview}
                            onCloseModal={onClose}
                        />
                    )}
                </Box>
            </ModalDialog>
        </Modal>
    );
};
