import { PartialBlock } from "@blocknote/core";
import { UserProps } from "./admin";

export type GroupedReactionProps = {
    senders: UserProps[];
    emoji: string;
    count: number;
};

export type ReactionProps = {
    id: number;
    emoji: string;
    sender: UserProps;
    tsSent: string;
};

// itemType:0 : Activity message
// itemType:1 : Join team request
// itemType:2 : Join project request
// itemType:3 : Join gm request
export type InboxItemProps = {
    itemId: number;
    itemBody: PartialBlock[] | any[];
    itemType: number;
    isRead: boolean;
    tsSent: string;
};
