import { UserProps } from "../../../types/admin";
import { NewMessageProps } from "../../../types/chat";

export interface MessageContext {
    fromMe: boolean;
    toMe: boolean;
    isEdited: boolean;
    isDeleted: boolean;
    isReactionUpdated: boolean;
}

export const analyzeMessageContext = (
    newMessage: NewMessageProps,
    myself: UserProps
): MessageContext => {
    let fromMe = false;
    let toMe = false;

    if (
        newMessage.chatType === 1 &&
        newMessage.sender.userId !== "" &&
        newMessage.receiver.userId !== "" &&
        newMessage.dmPartnerUser.userId !== ""
    ) {
        if (newMessage.receiver.userId === myself.userId) {
            if (newMessage.sender.userId === myself.userId) {
                fromMe = true;
                toMe = true;
            } else {
                toMe = true;
            }
        } else {
            if (newMessage.sender.userId === myself.userId) {
                fromMe = true;
            }
        }
    } else if (newMessage.chatType === 2 || newMessage.chatType === 3) {
        if (newMessage.sender.userId === myself.userId) {
            fromMe = true;
        }
    }

    return {
        fromMe,
        toMe,
        isEdited: newMessage.isEdited || false,
        isDeleted: newMessage.isDeleted || false,
        isReactionUpdated: newMessage.isReactionUpdated || false,
    };
};
