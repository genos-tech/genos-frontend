import { AppTooltip } from "../../../../components/ui/AppTooltip";
import { useTranslation } from "../../../../i18n";
import { Milestone } from "../../sprint-milestone/types";
import { TaskCardFrame } from "../card";
import { StatusLabel } from "../meta/StatusLabel";
import { MilestoneCardBody } from "../MilestoneCardBody";

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
// board's milestone card (MIP-1048), and the surface is the shared
// TaskCardFrame (MIP-1124). It is NOT the board card — that one is wrapped in
// @hello-pangea/dnd's <Draggable> and would throw outside a <DragDropContext>.
// Clicking the card opens the milestone's task graph (a hover tooltip signals
// that).
export const AssignedMilestoneCard = ({ milestone, sprintName, onOpen }: Props) => {
    const { t } = useTranslation();

    return (
        <AppTooltip title={t.tasks.dashboard.assignedMilestones.openDiagram}>
            <TaskCardFrame onOpen={() => onOpen(milestone)}>
                {/* Status — top-right; same label as the dashboard's Up Next rows.
                    (The sprint board shows its graph button here instead.) */}
                <MilestoneCardBody
                    milestone={milestone}
                    sprintName={sprintName}
                    topRight={<StatusLabel status={milestone.status} />}
                />
            </TaskCardFrame>
        </AppTooltip>
    );
};
