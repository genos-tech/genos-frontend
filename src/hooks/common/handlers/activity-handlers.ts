import { addActivityMessage } from "../../../features/chat/services/addActivityMessage";
import { UserProps } from "../../../types/admin";
import { ActivityMessageProps } from "../../../types/chat";
import { ChatManagementState } from "../../chats/useChatManagement";

function isInArray<T>(item: T, array: T[]): boolean {
    return array.includes(item);
}

export const handleActivityMessage = async (
    message: any,
    myself: UserProps,
    useCM: ChatManagementState
) => {
    const tmpNewActivityMessage: ActivityMessageProps = message;
    let newActivityMessage: ActivityMessageProps | undefined;

    if (!tmpNewActivityMessage) {
        console.error("Invalid message:", message);
        return;
    }

    // If it's a common thread message, task comment, or mention activity.
    if (tmpNewActivityMessage.activityType !== 2) {
        // If it's a thread or mention activity, add the activity
        // only when the sender of the reacted message is not myself.
        if (tmpNewActivityMessage.senderId !== myself.userId) {
            let doUpdateActivityMessage = false;

            if (
                tmpNewActivityMessage.mentionedUserIds &&
                isInArray(myself.userId, tmpNewActivityMessage.mentionedUserIds)
            ) {
                // console.log("Me mentioned");
                newActivityMessage = {
                    ...tmpNewActivityMessage,
                    activityType: 3,
                };
                doUpdateActivityMessage = true;
            } else if (tmpNewActivityMessage.isThread === true) {
                // console.log("thread replay from others");
                newActivityMessage = tmpNewActivityMessage;
                doUpdateActivityMessage = true;
            } else if (tmpNewActivityMessage.chatType === 2) {
                // console.log("GM message from others");
                newActivityMessage = tmpNewActivityMessage;
                doUpdateActivityMessage = true;
            } else if (tmpNewActivityMessage.chatType === 4) {
                // console.log("task comment from others");
                newActivityMessage = tmpNewActivityMessage;
                doUpdateActivityMessage = true;
            } else {
                newActivityMessage = undefined;
                // console.log("[IGNORE] Common message or mention but not to me");
            }

            if (doUpdateActivityMessage && newActivityMessage) {
                await addActivityMessage(newActivityMessage);
                useCM.funcSetActivityMessages();
            }
        } else {
            // console.log("[IGNORE] Thread, task comment or mention from myself");
        }
    } else {
        // If it's a reaction activity, add the activity
        // only when the sender of the reacted message is myself.
        if (
            tmpNewActivityMessage.senderId === myself.userId &&
            tmpNewActivityMessage.latestReaction.sender.userId !== myself.userId
        ) {
            // console.log("Got reaction to me");
            newActivityMessage = tmpNewActivityMessage;
            if (newActivityMessage) {
                await addActivityMessage(newActivityMessage);
                useCM.funcSetActivityMessages();
            }
        } else {
            // console.log("[IGNORE] Reaction to others message or reacted by myself");
        }
    }
};
