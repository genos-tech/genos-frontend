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
    requestStatus: "pending" | "approved" | "rejected";
    tsSent: string;
    // Request routing payload. Note-access items (itemType 4) carry
    // note_type/note_id/note_title so the card can open the referenced
    // note; other request types carry their own keys. Absent on plain
    // activity items.
    itemOptionals?: {
        note_type?: number;
        note_id?: number;
        note_title?: string;
        [key: string]: unknown;
    } | null;
};
