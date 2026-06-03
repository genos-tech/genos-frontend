import { addActivityMessage } from "../../../features/chat/components/sidebar/activity/services/addActivityMessage";
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
                // Align the live activityId with what `get_mention_activities`
                // returns on REST refresh ("3-<chat_type>-..."). The DB always
                // stores the row with the "1-" prefix and the GET endpoint
                // rewrites it to "3-" for mention rows; the live socket push
                // still ships the raw DB form, so without this swap the WS
                // upsert lands under "1-..." while the next history fetch
                // re-inserts the same row under "3-..." — two IDB rows, one
                // duplicate in the activity feed (visible after page refresh).
                newActivityMessage = {
                    ...tmpNewActivityMessage,
                    activityId:
                        tmpNewActivityMessage.activityId &&
                        tmpNewActivityMessage.activityId[0] === "1"
                            ? "3" + tmpNewActivityMessage.activityId.slice(1)
                            : tmpNewActivityMessage.activityId,
                    activityType: 3,
                };
                doUpdateActivityMessage = true;
            } else if (tmpNewActivityMessage.isThread === true) {
                newActivityMessage = tmpNewActivityMessage;
                doUpdateActivityMessage = true;
            } else if (tmpNewActivityMessage.chatType === 2) {
                newActivityMessage = tmpNewActivityMessage;
                doUpdateActivityMessage = true;
            } else if (tmpNewActivityMessage.chatType === 4) {
                newActivityMessage = tmpNewActivityMessage;
                doUpdateActivityMessage = true;
            } else {
                newActivityMessage = undefined;
            }

            if (doUpdateActivityMessage && newActivityMessage) {
                await addActivityMessage(newActivityMessage);
                useCM.funcSetActivityMessages();
            }
        }
    } else {
        // If it's a reaction activity, add the activity
        // only when the sender of the reacted message is myself.
        if (
            tmpNewActivityMessage.senderId === myself.userId &&
            tmpNewActivityMessage.latestReaction.sender.userId !== myself.userId
        ) {
            newActivityMessage = tmpNewActivityMessage;
            if (newActivityMessage) {
                await addActivityMessage(newActivityMessage);
                useCM.funcSetActivityMessages();
            }
        }
    }
};
