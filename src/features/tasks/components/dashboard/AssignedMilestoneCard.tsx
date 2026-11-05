import { Box } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";

import { AppTooltip } from "../../../../components/ui/AppTooltip";
import { useTranslation } from "../../../../i18n";
import { Milestone } from "../../sprint-milestone/types";
import { MilestoneCardBody } from "../MilestoneCardBody";
import { TaskStatusChip } from "../TaskStatusChip";

type Props = {
    milestone: Milestone;
    // Resolved sprint name for this milestone (null → "No Sprint"). Resolved
    // by the parent from the current project's sprints.
    sprintName: string | null;
    // Opens the task graph for this milestone (the parent renders the
    // LazyTaskDiagram and passes the viewer's id as highlightAssigneeId).
    onOpen: (milestone: Milestone) => void;
};

// A standalone milestone summary card for the dashboard's "Assigned
// Milestones" section. The inside is MilestoneCardBody, shared with the sprint
// board's milestone card (MIP-1048); this is only the shell. It is NOT the
// board card — that one is wrapped in @hello-pangea/dnd's <Draggable> and
// would throw outside a <DragDropContext>. Clicking the card opens the
// milestone's task graph (a hover tooltip signals that).
export const AssignedMilestoneCard = ({ milestone, sprintName, onOpen }: Props) => {
    const { mode } = useColorScheme();
    const isDark = mode === "dark";
    const { t } = useTranslation();

    return (
        <AppTooltip title={t.tasks.dashboard.assignedMilestones.openDiagram}>
            <Box
                role="button"
                tabIndex={0}
                sx={{
                    backgroundColor: isDark ? "#1a1a24" : "#ffffff",
                    borderRadius: "8px",
                    p: 1.25,
                    border:
                        mode === "dark"
                            ? "1px solid rgba(255, 255, 255, 0.06)"
                            : "1px solid rgba(0, 0, 0, 0.06)",
                    boxShadow:
                        mode === "dark"
                            ? "0 1px 2px rgba(0, 0, 0, 0.2)"
                            : "0 1px 2px rgba(0, 0, 0, 0.05)",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                    display: "flex",
                    flexDirection: "column",
                    minWidth: 0,
                    "&:hover": {
                        transform: "translateY(-1px)",
                        boxShadow:
                            mode === "dark"
                                ? "0 4px 12px rgba(0, 0, 0, 0.4)"
                                : "0 4px 12px rgba(0, 0, 0, 0.1)",
                        borderColor: "#f97316",
                    },
                }}
                onClick={() => onOpen(milestone)}
                onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onOpen(milestone);
                    }
                }}
            >
                {/* Status — top-right; same chip as the dashboard's Up Next rows.
                    (The sprint board shows its graph button here instead.) */}
                <MilestoneCardBody
                    milestone={milestone}
                    sprintName={sprintName}
                    topRight={<TaskStatusChip status={milestone.status} />}
                />
            </Box>
        </AppTooltip>
    );
};
