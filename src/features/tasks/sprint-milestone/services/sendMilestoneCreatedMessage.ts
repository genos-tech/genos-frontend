import { channelService } from "../../../../services/channel/channelService";
import { UserProps } from "../../../../types/admin";
import { ProjectProps } from "../../../../types/tasks";
import { milestoneMessageTemplate } from "../../utils/TaskMessageTemplate";
import { Milestone } from "../types";

type SendMilestoneCreatedMessageInput = {
    myself: UserProps;
    project: ProjectProps;
    milestone: Milestone;
    sprintName: string;
    reporter: UserProps;
    assignees: UserProps[];
    // Chat-thread origin captured at create-intent time (the thread
    // header's "Create task" action). Replaces the old sniffing of
    // useCM.currentThreadChat at send time, which pointed at whatever
    // thread was open LAST — not necessarily the one this milestone
    // was created from.
    fromThread: { chatType: number; chatId: string; threadId: string } | null;
};

/**
 * Reply with the new milestone's summary in the DM or group thread it was made
 * from, mirroring `uploadNewTask`. This reply is also what marks the thread as
 * task-linked for other members (their `taskExist` scan reads its metadata), so
 * it targets the CAPTURED origin thread, not whatever pane happens to be open
 * when the create finishes. A milestone made anywhere else sends nothing: the
 * project chat's card is posted by the api (MIP-2483).
 *
 * Failures are logged, never thrown, so a chat hiccup can't block the
 * milestone preview from opening.
 */
export const sendMilestoneCreatedMessage = async ({
    myself,
    project,
    milestone,
    sprintName,
    reporter,
    assignees,
    fromThread,
}: SendMilestoneCreatedMessageInput): Promise<void> => {
    if (
        !fromThread ||
        (fromThread.chatType !== 1 && fromThread.chatType !== 2 && fromThread.chatType !== 4)
    ) {
        return;
    }
    if (!project.systemUserId) {
        console.error("[sendMilestoneCreatedMessage] project.systemUserId missing");
        return;
    }
    if (milestone.taskId == null) {
        console.error(
            "[sendMilestoneCreatedMessage] milestone.taskId missing; bubble's 'Open Task' chip would not route to MilestonePreview"
        );
        return;
    }

    const createMilestoneMessage = milestoneMessageTemplate(
        myself,
        milestone,
        sprintName,
        reporter,
        assignees
    );
    if (!createMilestoneMessage) return;

    try {
        // `taskId` is the milestone's backing task, so the bubble's "Open Task"
        // chip reroutes to MilestonePreview (via TaskPreview's milestone detection).
        await channelService.send(fromThread.chatId, createMilestoneMessage, {
            bodyText: milestone.title,
            parentId: fromThread.threadId,
            metadata: {
                taskId: milestone.taskId,
                taskStatus: milestone.status,
                systemUserId: project.systemUserId,
            },
        });
    } catch (e) {
        console.error(
            "[sendMilestoneCreatedMessage] failed to post milestone into open thread",
            e
        );
    }
};
