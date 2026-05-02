import { Socket } from "socket.io-client";

import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { UserProps } from "../../../../types/admin";
import { ProjectProps } from "../../../../types/tasks";
import {
    milestoneCreatedThreadMessageTemplate,
    milestoneMessageTemplate,
} from "../../utils/TaskMessageTemplate";
import { Milestone } from "../types";

type SendMilestoneCreatedMessageInput = {
    socket: Socket | null;
    myself: UserProps;
    project: ProjectProps;
    milestone: Milestone;
    sprintName: string;
    reporter: UserProps;
    assignees: UserProps[];
    useCM: ChatManagementState;
};

/**
 * Mirrors the socket fan-out at the tail of `uploadNewTask` for the
 * milestone path: joins the project's PM chat group, posts a "milestone
 * created" message bubble keyed off the milestone's backing taskId
 * (so the bubble's "Open Task" chip routes to MilestonePreviewInner
 * via the existing `fromNoteMilestoneId` reroute in TaskPreview), then
 * follows up with a system "A new milestone has been created by ..."
 * thread message — and finally also rebroadcasts into the currently
 * visible thread chat when the user happens to have one open.
 *
 * Failures are logged but never thrown, matching the spirit of
 * `uploadNewTask` so chat hiccups don't block the milestone preview
 * from opening.
 */
export const sendMilestoneCreatedMessage = ({
    socket,
    myself,
    project,
    milestone,
    sprintName,
    reporter,
    assignees,
    useCM,
}: SendMilestoneCreatedMessageInput): void => {
    if (!socket) {
        console.error("[sendMilestoneCreatedMessage] socket not found");
        return;
    }
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

    // 1. Join the project's PM chat group (chatType === 3 is the PM
    //    channel; the backend uses systemUserId as the sender so the
    //    bubble shows up authored by the project bot).
    socket.emit(
        "join",
        {
            joiningCGId: project.projectId,
            joiningCGName: project.projectName,
            chatType: 3,
            dmPartnerUserId: null,
        },
        () => {
            // 2. Post the rich "milestone created" bubble into PM.
            socket.emit(
                "message",
                {
                    methodType: "POST",
                    message: createMilestoneMessage,
                    destCGName: project.projectName,
                    destCGId: project.projectId,
                    chatType: 3,
                    dmPartnerUserId: null,
                    taskId: milestone.taskId,
                    taskStatus: milestone.status,
                    systemUserId: project.systemUserId,
                    messageIdForPut: null,
                },
                () => {
                    // 3. Follow-up system thread message ("A new
                    //    milestone has been created by @me") attached
                    //    to that bubble's thread.
                    const threadMessage = milestoneCreatedThreadMessageTemplate(myself);
                    socket.emit("thread_message", {
                        methodType: "POST",
                        isInit: false,
                        rootMessageTSSent: "",
                        rootMessageSenderId: null,
                        rootMessageReceiverId: null,
                        threadId: null,
                        threadMessage,
                        chatType: 3,
                        dmPartnerUserId: null,
                        senderId: project.systemUserId,
                        senderName: project.projectName,
                        destCGName: project.projectName,
                        destCGId: project.projectId,
                        taskId: milestone.taskId,
                        systemUserId: project.systemUserId,
                        messageIdForPut: null,
                    });
                }
            );

            // 4. If the user happened to be inside a thread chat
            //    when they hit "Create Milestone", surface the bubble
            //    in that thread too — same shape as the task path so
            //    the milestone is discoverable from where the user
            //    actually is. Milestones are normally created from
            //    the sidebar, but mirroring the task behaviour keeps
            //    semantics consistent.
            if (
                useCM.isThreadVisible === true &&
                useCM.currentMainChat &&
                useCM.currentThreadChat &&
                (useCM.currentMainChat.chatType === 1 ||
                    useCM.currentMainChat.chatType === 2 ||
                    useCM.currentMainChat.chatType === 4) &&
                useCM.currentThreadChat.threadId !== null &&
                useCM.currentThreadChat.threadId !== 0
            ) {
                socket.emit("message", {
                    methodType: "PUT",
                    message: null,
                    destCGName: useCM.currentMainChat.chatName,
                    destCGId: useCM.currentMainChat.chatId,
                    chatType: useCM.currentMainChat.chatType,
                    dmPartnerUserId: useCM.currentMainChat.dmPartnerUser.userId,
                    taskId: milestone.taskId,
                    taskStatus: milestone.status,
                    systemUserId: project.systemUserId,
                    messageIdForPut: useCM.currentThreadChat.threadId,
                    isPrivate: useCM.currentMainChat.isPrivate,
                });

                socket.emit("thread_message", {
                    methodType: "POST",
                    isInit: false,
                    rootMessageTSSent: "",
                    rootMessageSenderId: null,
                    rootMessageReceiverId: null,
                    threadId: useCM.currentThreadChat.threadId,
                    threadMessage: createMilestoneMessage,
                    chatType: useCM.currentThreadChat.chatType,
                    dmPartnerUserId: useCM.currentThreadChat.dmPartnerUser.userId,
                    senderId: project.systemUserId,
                    senderName: project.projectName,
                    destCGName: useCM.currentThreadChat.chatName,
                    destCGId: useCM.currentThreadChat.chatId,
                    taskId: milestone.taskId,
                    taskStatus: milestone.status,
                    systemUserId: project.systemUserId,
                    messageIdForPut: null,
                });
            }
        }
    );
};
