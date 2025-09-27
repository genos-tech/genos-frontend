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

export type InboxItemProps = {
    itemId: number;
    itemBody: PartialBlock[] | any[];
    itemType: number;
    isRead: boolean;
    tsSent: string;
};
