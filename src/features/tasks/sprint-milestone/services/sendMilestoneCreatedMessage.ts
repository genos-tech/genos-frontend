import { channelService } from "../../../../services/channel/channelService";
import { UserProps } from "../../../../types/admin";
import { ProjectProps } from "../../../../types/tasks";
import { findPmChannelForProject } from "../../services/findPmChannel";
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
 * Post the "milestone created" chat bubble into the project's PM channel,
 * mirroring the task-created fan-out in `uploadNewTask`.
 *
 * History: this used to emit the legacy `join` / `message` /
 * `thread_message` socket events on the default namespace — handlers that
 * were DELETED in the v3 chat cutover, so nothing persisted: no message,
 * no activity-feed row, and no notification. It now routes through
 * `channelService.send` (the v3 `message.send` path) exactly like
 * `uploadNewTask`. The message template @-mentions the reporter/assignees,
 * so the v3 message path produces the MENTION activities + web pushes for
 * free — no separate notification plumbing here.
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
    if (!project.systemUserId) {
        console.error(
            "[sendMilestoneCreatedMessage] project.systemUserId missing; cannot route milestone message"
        );
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

    const projectId = project.projectId;

    // Resolve the project's PM channel from the channelService snapshot,
    // falling back to a one-shot REST refresh (mirrors uploadNewTask) — the
    // refresh covers a PM channel the user only just gained membership of
    // and that the boot-time snapshot therefore missed.
    let pmChannel = findPmChannelForProject(
        channelService.getSnapshot().channels.values(),
        projectId
    );
    if (!pmChannel) {
        try {
            const fresh = await channelService.listChannels();
            const freshPm = findPmChannelForProject(fresh, projectId);
            if (freshPm) {
                channelService.handleChannelCreated(freshPm);
                pmChannel = freshPm;
            }
        } catch (e) {
            console.error(
                "[sendMilestoneCreatedMessage] failed to refresh channels for PM lookup",
                e
            );
        }
    }
    if (!pmChannel) {
        console.error("[sendMilestoneCreatedMessage] PM channel not found for project", {
            projectId,
        });
        return;
    }

    // `taskId` is the milestone's backing task, so the bubble's "Open Task"
    // chip reroutes to MilestonePreview (via TaskPreview's milestone
    // detection) just like the legacy path did.
    const metadata = {
        taskId: milestone.taskId,
        taskStatus: milestone.status,
        systemUserId: project.systemUserId,
    };

    // 1. Top-level "milestone created" bubble in PM. No system thread
    //    follow-up: the thread's Activities tab renders the structured
    //    audit log instead of system bubbles.
    try {
        await channelService.send(pmChannel.id, createMilestoneMessage, {
            bodyText: milestone.title,
            metadata,
        });
    } catch (e) {
        console.error("[sendMilestoneCreatedMessage] failed to post PM milestone message", e);
    }

    // 2. If the milestone was created from a DM/GM/MDM thread, surface
    //    the bubble there too — same parity uploadNewTask keeps for
    //    tasks. This card is also what marks the thread as task-linked
    //    for other members (their `taskExist` scan reads its metadata),
    //    so it targets the CAPTURED origin thread, not whatever pane
    //    happens to be open when the create finishes.
    if (
        fromThread &&
        (fromThread.chatType === 1 || fromThread.chatType === 2 || fromThread.chatType === 4)
    ) {
        try {
            await channelService.send(fromThread.chatId, createMilestoneMessage, {
                bodyText: milestone.title,
                parentId: fromThread.threadId,
                metadata,
            });
        } catch (e) {
            console.error(
                "[sendMilestoneCreatedMessage] failed to post milestone into open thread",
                e
            );
        }
    }
};
