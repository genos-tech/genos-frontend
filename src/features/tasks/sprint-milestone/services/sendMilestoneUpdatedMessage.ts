import { channelService } from "../../../../services/channel/channelService";
import { UserProps } from "../../../../types/admin";
import { milestoneMessageTemplate } from "../../utils/TaskMessageTemplate";
import { Milestone } from "../types";

type SendMilestoneUpdatedMessageInput = {
    myself: UserProps;
    milestone: Milestone;
    sprintName: string;
    reporter: UserProps;
    assignees: UserProps[];
    systemUserId?: string | null;
};

/**
 * Rewrite the milestone's PM "card" bubble after a metadata edit (status /
 * title / priority / assignee / due / ...) — the milestone twin of the
 * task-card sync in `sendUpdatedSpecificTask`.
 *
 * The card message is linked by `metadata.taskId = milestone.taskId` (set
 * in `sendMilestoneCreatedMessage`), so the by-task-id
 * `channelService.updateTaskCard` locates + rewrites it and the server
 * broadcasts `message.updated` to every PM viewer. The body is rebuilt with
 * the SAME `milestoneMessageTemplate` the create path uses, so the card
 * stays byte-for-byte consistent with a freshly-created one.
 *
 * Fire-and-forget by contract: never throws — a chat hiccup must not
 * surface on the milestone save. No-ops when the milestone has no backing
 * task (so no PM card exists) or the template yields nothing.
 */
export const sendMilestoneUpdatedMessage = async ({
    myself,
    milestone,
    sprintName,
    reporter,
    assignees,
    systemUserId,
}: SendMilestoneUpdatedMessageInput): Promise<void> => {
    if (milestone.taskId == null) return;
    const cardBody = milestoneMessageTemplate(myself, milestone, sprintName, reporter, assignees);
    if (!cardBody) return;
    try {
        await channelService.updateTaskCard(milestone.taskId, cardBody, milestone.title, {
            taskId: milestone.taskId,
            taskStatus: milestone.status,
            systemUserId: systemUserId ?? undefined,
        });
    } catch (e) {
        console.error("[sendMilestoneUpdatedMessage] failed to sync milestone card", e);
    }
};
